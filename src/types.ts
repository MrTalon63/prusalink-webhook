export enum PrinterState {
	IDLE = "IDLE",
	BUSY = "BUSY",
	PRINTING = "PRINTING",
	PAUSED = "PAUSED",
	FINISHED = "FINISHED",
	STOPPED = "STOPPED",
	ERROR = "ERROR",
	ATTENTION = "ATTENTION",
	READY = "READY",
}

export interface PrinterStatus {
	state: PrinterState;
	tempBed?: number;
	targetBed?: number;
	tempNozzle?: number;
	targetNozzle?: number;
	axisZ?: number;
	axisX?: number;
	axisY?: number;
	flow?: number;
	speed?: number;
	fanHotend?: number;
	fanPrint?: number;
	statusPrinter?: {
		ok: boolean;
		message: string;
	};
	statusConnect?: {
		ok: boolean;
		message: string;
	};
}

export interface PrinterJob {
	id: number;
	state: PrinterState;
	progress: number;
	time_remaining: number;
	time_printing: number;
	file: {
		refs: {
			icon: string;
			thumbnail: string;
			download: string;
		};
		name: string;
		display_name: string;
		path: string;
		size: number;
		m_timestamp: number;
	};
}
