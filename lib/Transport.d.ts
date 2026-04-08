import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { HandlerFactory, HandlerInterface } from './handlers/HandlerInterface';
import { Producer, ProducerOptions } from './Producer';
import { Consumer, ConsumerOptions } from './Consumer';
import { DataProducer, DataProducerOptions } from './DataProducer';
import { DataConsumer, DataConsumerOptions } from './DataConsumer';
import { RtpParameters, MediaKind, RtpCapabilities } from './RtpParameters';
import { SctpParameters, SctpStreamParameters } from './SctpParameters';
import { AppData } from './types';
export type TransportOptions<TransportAppData extends AppData = AppData> = {
    iceParameters?: IceParameters;
    iceCandidates?: IceCandidate[];
    dtlsParameters?: DtlsParameters;
    sctpParameters?: SctpParameters;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    additionalSettings?: any;
    appData?: TransportAppData;
};
export type CanProduceByKind = {
    audio: boolean;
    video: boolean;
    [key: string]: boolean;
};
export type IceParameters = {
    usernameFragment: string;
    password: string;
    iceLite?: boolean;
};
export type IceCandidate = {
    foundation: string;
    priority: number;
    address: string;
    ip: string;
    protocol: 'udp' | 'tcp';
    port: number;
    type: 'host' | 'srflx' | 'prflx' | 'relay';
    tcpType?: 'active' | 'passive' | 'so';
};
export type DtlsParameters = {
    role?: DtlsRole;
    fingerprints: DtlsFingerprint[];
};
export type FingerprintAlgorithm = 'sha-1' | 'sha-224' | 'sha-256' | 'sha-384' | 'sha-512';
export type DtlsFingerprint = {
    type: FingerprintAlgorithm;
    hash: string;
};
export type DtlsRole = 'auto' | 'client' | 'server';
export type IceGatheringState = 'new' | 'gathering' | 'complete';
export type IceConnectionState = 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';
export type PlainRtpParameters = {
    ip: string;
    ipVersion: 4 | 6;
    port: number;
};
export type TransportEvents = {
    connect: [{
        dtlsParameters: DtlsParameters;
        iceParameters: IceParameters;
    }, () => void, (error: Error) => void];
    icecandidate: [RTCIceCandidate | null];
    icegatheringstatechange: [IceGatheringState];
    iceconnectionstatechange: [IceConnectionState];
    produce: [{
        id: string;
        kind: MediaKind;
        rtpParameters: RtpParameters;
        appData: AppData;
    }];
    producedata: [{
        sctpStreamParameters: SctpStreamParameters;
        label?: string;
        protocol?: string;
        appData: AppData;
    }, ({ id }: {
        id: string;
    }) => void, (error: Error) => void];
};
export type TransportObserverEvents = {
    close: [];
    newproducer: [Producer];
    newconsumer: [Consumer];
    newdataproducer: [DataProducer];
    newdataconsumer: [DataConsumer];
};
export declare class Transport<TransportAppData extends AppData = AppData> extends EnhancedEventEmitter<TransportEvents> {
    readonly id: string;
    closed: boolean;
    readonly direction: 'send' | 'recv';
    readonly extendedRtpCapabilities: RtpCapabilities;
    readonly canProduceByKind: CanProduceByKind;
    readonly maxSctpMessageSize?: number | null;
    readonly handler: HandlerInterface;
    iceGatheringState: IceGatheringState;
    iceConnectionState: IceConnectionState;
    appData: TransportAppData;
    private readonly _producers;
    private readonly _consumers;
    private readonly _dataProducers;
    private readonly _dataConsumers;
    private readonly _awaitQueue;
    private _pendingConsumerTasks;
    private _consumerCreationInProgress;
    private _pendingPauseConsumers;
    private _consumerPauseInProgress;
    private _pendingResumeConsumers;
    private _consumerResumeInProgress;
    private _pendingCloseConsumers;
    private _consumerCloseInProgress;
    readonly observer: EnhancedEventEmitter<TransportObserverEvents>;
    constructor({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, handlerFactory, extendedRtpCapabilities, canProduceByKind, }: {
        direction: 'send' | 'recv';
        handlerFactory: HandlerFactory;
        extendedRtpCapabilities: RtpCapabilities;
        canProduceByKind: CanProduceByKind;
    } & TransportOptions<TransportAppData>);
    /**
     * Close the Transport.
     */
    close(): void;
    /**
     * Get associated Transport (RTCPeerConnection) stats.
     *
     * @returns {RTCStatsReport}
     */
    getStats(): Promise<RTCStatsReport>;
    /**
     * Restart ICE connection.
     */
    restartIce({ iceParameters }: {
        iceParameters: IceParameters;
    }): Promise<void>;
    /**
     * Update ICE servers.
     */
    updateIceServers({ iceServers }?: {
        iceServers?: RTCIceServer[];
    }): Promise<void>;
    /**
     * Add a new ICE candidate from the remote endpoint.
     */
    addIceCandidate({ candidate }: {
        candidate: RTCIceCandidate | null;
    }): Promise<void>;
    /**
     * Connect the Transport.
     */
    connect({ dtlsParameters, iceParameters }: {
        dtlsParameters: DtlsParameters;
        iceParameters: IceParameters;
    }): Promise<void>;
    /**
     * Create a Producer.
     */
    produce<ProducerAppData extends AppData = AppData>({ track, codecOptions, codec, stopTracks, disableTrackOnPause, zeroRtpOnPause, appData, }?: ProducerOptions<ProducerAppData>): Promise<Producer<ProducerAppData>>;
    /**
     * Create a Consumer to consume a remote Producer.
     */
    consume<ConsumerAppData extends AppData = AppData>({ id, kind, rtpParameters, streamId, appData, }: ConsumerOptions<ConsumerAppData>): Promise<Consumer<ConsumerAppData>>;
    /**
     * Create a DataProducer
     */
    produceData<DataProducerAppData extends AppData = AppData>({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol, appData, }?: DataProducerOptions<DataProducerAppData>): Promise<DataProducer<DataProducerAppData>>;
    /**
     * Create a DataConsumer
     */
    consumeData<ConsumerAppData extends AppData = AppData>({ id, dataProducerId, sctpStreamParameters, label, protocol, appData, }: DataConsumerOptions<ConsumerAppData>): Promise<DataConsumer<ConsumerAppData>>;
    private createPendingConsumers;
    private pausePendingConsumers;
    private resumePendingConsumers;
    private closePendingConsumers;
    private handleHandler;
    private handleProducer;
    private handleConsumer;
    private handleDataProducer;
    private handleDataConsumer;
}
//# sourceMappingURL=Transport.d.ts.map