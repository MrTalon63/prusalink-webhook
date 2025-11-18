import { env } from "bun";
import { BunSqliteKeyValue } from "bun-sqlite-key-value";
import { PrinterState, PrinterStatus, PrinterJob } from "./types";

const kv = new BunSqliteKeyValue("./kv.db");

async function main() {
	console.info("Starting PrusaLink Webhook Monitor...");

	setInterval(async () => {
		const status = await getStatus();
		const lastState = (await kv.get("lastState")) as PrinterState | null;

		switch (status.state) {
			case PrinterState.PRINTING:
				if (lastState !== PrinterState.PRINTING) {
					const job = await getJob();
					console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
					await sendSimpleWebhook(`🖨️ Rozpoczynam drukowanie \`${job.file.display_name}\`.\nCzas drukowania: ${await parseMilliseconds(job.time_remaining)} minut`);
					await kv.set("lastState", PrinterState.PRINTING);
					await kv.set("lastJobId", job.id);
					await kv.set("lastJobName", job.file.display_name);
					await kv.set("lastJobThumbnail", job.file.refs.thumbnail);
				}
				break;

			case PrinterState.PAUSED:
				if (lastState !== PrinterState.PAUSED) {
					console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
					await sendSimpleWebhook("⏸️ Druk został wstrzymany.");
				}
				await kv.set("lastState", PrinterState.PAUSED);
				break;

			case PrinterState.FINISHED:
				if (lastState !== PrinterState.FINISHED) {
					console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
					const lastJobName = (await kv.get("lastJobName")) as string | null;
					await sendSimpleWebhook(`✅ Druk ${lastJobName ? `\`${lastJobName}\`` : ""} został zakończony pomyślnie!`);
				}
				await kv.set("lastState", PrinterState.FINISHED);
				break;

			case PrinterState.ERROR:
			case PrinterState.ATTENTION:
				if (lastState !== PrinterState.ATTENTION) {
					console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
					await sendSimpleWebhook(`⚠️ Uwaga! Wystąpił problem: ${status.statusPrinter?.message || "Nieznany błąd."}\nSprawdź drukarkę!`);
				}
				await kv.set("lastState", PrinterState.ATTENTION);
				break;

			//			case PrinterState.IDLE:
			//			case PrinterState.STOPPED:
			//				if (lastState !== PrinterState.IDLE) {
			//					console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
			//					await sendSimpleWebhook("💤 Drukarka jest teraz bezczynna.");
			//				}
			//				await kv.set("lastState", PrinterState.IDLE);
			//				break;
			//
			//			default:
			//				await kv.set("lastState", status.state);
			//				console.debug(`Current State: ${status.state}\nLast State: ${lastState}`);
			//				break;
		}
	}, parseInt(env.DELAY_MS || "60000"));
}

async function getStatus() {
	const req = await fetch(`${env.PRUSALINK_API_URL}/api/v1/status`, {
		headers: {
			"X-Api-Key": env.PRUSALINK_API_KEY || "",
		},
	});
	if (!req.ok) {
		throw new Error(`Failed to fetch printer status: ${req.status} ${req.statusText}`);
	}
	const res = (await req.json()) as { printer: PrinterStatus };
	return res.printer;
}

async function getJob() {
	const req = await fetch(`${env.PRUSALINK_API_URL}/api/v1/job`, {
		headers: {
			"X-Api-Key": env.PRUSALINK_API_KEY || "",
		},
	});
	if (!req.ok) {
		throw new Error(`Failed to fetch printer status: ${req.status} ${req.statusText}`);
	}
	const res = (await req.json()) as PrinterJob;
	return res;
}

async function sendSimpleWebhook(message: string) {
	const req = await fetch(env.WEBHOOK_URL || "", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content: message,
		}),
	});

	if (!req.ok) {
		throw new Error(`Failed to send webhook: ${req.status} ${req.statusText}`);
	}

	console.info(`Webhook sent: ${message}`);
}

async function parseMilliseconds(ms: number) {
	const days = Math.floor(ms / 86400000);
	const hours = Math.floor(ms / 3600000) % 24;
	const minutes = Math.floor(ms / 60000) % 60;
	const seconds = Math.floor(ms / 1000) % 60;
	const time = { days, hours, minutes, seconds };

	// @ts-expect-error TypeScript doesn't know about Intl.DurationFormat yet
	return new Intl.DurationFormat("pl-PL", { style: "long" }).format(time);
}

const exampleJob = {
	id: 291,
	state: "PRINTING",
	progress: 0.0,
	time_remaining: 33660,
	time_printing: 938,
	file: {
		refs: { icon: "/thumb/s/usb/LBANDH~2.BGC", thumbnail: "/thumb/l/usb/LBANDH~2.BGC", download: "/usb/LBANDH~2.BGC" },
		name: "LBANDH~2.BGC",
		display_name: "L Band helix radome_0.4n_0.1mm_PETG_COREONE_9h23m.bgcode",
		path: "/usb",
		size: 1229184,
		m_timestamp: 1762907189,
	},
};

const exampleStatus = {
	job: {
		id: 291,
		progress: 0.0,
		time_remaining: 33660,
		time_printing: 943,
	},
	storage: {
		path: "/usb/",
		name: "usb",
		read_only: false,
	},
	printer: {
		state: "PRINTING",
		temp_bed: 84.8,
		target_bed: 85.0,
		temp_nozzle: 250.0,
		target_nozzle: 250.0,
		axis_z: 0.2,
		flow: 100,
		speed: 100,
		fan_hotend: 8315,
		fan_print: 0,
	},
};

main();
