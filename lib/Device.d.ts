import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { Transport, TransportOptions } from './Transport';
import { HandlerFactory } from './handlers/HandlerInterface';
import { RtpCapabilities, MediaKind } from './RtpParameters';
import { SctpCapabilities } from './SctpParameters';
import { AppData } from './types';
export type BuiltinHandlerName = 'Chrome74' | 'Firefox60' | 'Safari12';
export type DeviceOptions = {
    handlerName?: BuiltinHandlerName;
    handlerFactory?: HandlerFactory;
    Handler?: string;
};
export declare function detectDevice(): BuiltinHandlerName | undefined;
export type DeviceObserverEvents = {
    newtransport: [Transport];
};
export declare class Device {
    private readonly _handlerFactory;
    private readonly _handlerName;
    private _loaded;
    private _extendedRtpCapabilities?;
    private _recvRtpCapabilities?;
    private readonly _canProduceByKind;
    private _sctpCapabilities?;
    protected readonly _observer: EnhancedEventEmitter<DeviceObserverEvents>;
    private resolveReady;
    ready: Promise<void>;
    constructor({ handlerName, handlerFactory, Handler }?: DeviceOptions);
    get handlerName(): string;
    get rtpCapabilities(): RtpCapabilities;
    get sctpCapabilities(): SctpCapabilities;
    get observer(): EnhancedEventEmitter;
    getRtpCapabilities(): Promise<RtpCapabilities>;
    load({ remoteRtpCapabilities }: {
        remoteRtpCapabilities: RtpCapabilities;
    }): Promise<void>;
    canProduce(kind: MediaKind): boolean;
    createSendTransport<TransportAppData extends AppData = AppData>({ iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, }?: TransportOptions<TransportAppData>): Transport<TransportAppData>;
    createRecvTransport<TransportAppData extends AppData = AppData>({ iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, }?: TransportOptions<TransportAppData>): Transport<TransportAppData>;
    private createTransport;
}
//# sourceMappingURL=Device.d.ts.map