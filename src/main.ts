import { env } from "bun";
import { BunSqliteKeyValue } from "bun-sqlite-key-value";
import { PrinterState, PrinterStatus } from "./types";

const kv = new BunSqliteKeyValue("./kv.db");

async function main() {
	console.info("Starting PrusaLink Webhook Monitor...");

	setInterval(async () => {
		const status = await getStatus();
		const lastState = (await kv.get("lastState")) as PrinterState | null;

		switch (status.state) {
			case PrinterState.PRINTING:
				if (lastState !== PrinterState.PRINTING) {
					await sendSimpleWebhook("🖨️ Rozpoczynam druk!");
				}
				await kv.set("lastState", PrinterState.PRINTING);
				break;

			case PrinterState.PAUSED:
				if (lastState !== PrinterState.PAUSED) {
					await sendSimpleWebhook("⏸️ Druk został wstrzymany.");
				}
				await kv.set("lastState", PrinterState.PAUSED);
				break;

			case PrinterState.FINISHED:
				if (lastState !== PrinterState.FINISHED) {
					await sendSimpleWebhook("✅ Druk zakończony pomyślnie!");
				}
				await kv.set("lastState", PrinterState.FINISHED);
				break;

			case PrinterState.ERROR:
			case PrinterState.ATTENTION:
				if (lastState !== status.state) {
					await sendSimpleWebhook(`⚠️ Uwaga! Wystąpił problem: ${status.statusPrinter?.message || "Nieznany błąd."}`);
				}
				await kv.set("lastState", status.state);
				break;

			case PrinterState.IDLE:
				if (lastState !== PrinterState.IDLE) {
					await sendSimpleWebhook("🛑 Drukarka jest teraz bezczynna.");
				}
				await kv.set("lastState", PrinterState.IDLE);
				break;

			default:
				await kv.set("lastState", status.state);
				break;
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
}

main();
