export type LinkKind = "ble" | "usb" | "mock";

/** A bidirectional byte stream to the board. BLE, USB and Mock all implement it. */
export interface Link {
  readonly kind: LinkKind;
  /** Transport-specific id of the peer, e.g. the BLE device id, remembered for reconnecting. */
  readonly peerId?: string;
  /** Serial links only: the UART speed in use. */
  readonly baudRate?: number;
  open(): Promise<void>;
  close(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  /** Returns an unsubscribe function. */
  onData(cb: (bytes: Uint8Array) => void): () => void;
  /** Fires once when the link closes; `error` is set when it wasn't requested. */
  onClose(cb: (error?: Error) => void): () => void;
}
