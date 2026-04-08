import { EnhancedEventEmitter } from '../EnhancedEventEmitter';
import { ProducerCodecOptions } from '../Producer';
import { IceParameters, IceCandidate, DtlsParameters, IceGatheringState, DtlsRole, IceConnectionState } from '../Transport';
import { RtpCapabilities, RtpCodecCapability, RtpParameters } from '../RtpParameters';
import { SctpCapabilities, SctpParameters, SctpStreamParameters } from '../SctpParameters';
import { RemoteSdp } from './sdp/RemoteSdp';
import * as sdpTransform from 'sdp-transform';
export type HandlerFactory = () => HandlerInterface;
export type HandlerRunOptions = {
    direction: 'send' | 'recv';
    iceParameters?: IceParameters;
    iceCandidates?: IceCandidate[];
    dtlsParameters?: DtlsParameters;
    sctpParameters?: SctpParameters;
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy;
    additionalSettings?: any;
    extendedRtpCapabilities: RtpCapabilities;
};
export type HandlerSendOptions = {
    track: MediaStreamTrack;
    codecOptions?: ProducerCodecOptions;
    codec?: RtpCodecCapability;
};
export type HandlerSendResult = {
    id: string;
    localId: string;
    rtpParameters: RtpParameters;
    rtpSender?: RTCRtpSender;
};
export type HandlerReceiveOptions = {
    trackId: string;
    kind: 'audio' | 'video';
    rtpParameters: RtpParameters;
    streamId?: string;
};
export type HandlerReceiveResult = {
    localId: string;
    track: MediaStreamTrack;
    rtpReceiver?: RTCRtpReceiver;
};
export type HandlerSendDataChannelOptions = SctpStreamParameters;
export type HandlerSendDataChannelResult = {
    dataChannel: RTCDataChannel;
    sctpStreamParameters: SctpStreamParameters;
};
export type HandlerReceiveDataChannelOptions = {
    sctpStreamParameters: SctpStreamParameters;
    label: string;
    protocol?: string;
};
export type HandlerReceiveDataChannelResult = {
    dataChannel: RTCDataChannel;
};
export type HandlerEvents = {
    '@close': [];
    '@connect': [{
        dtlsParameters: DtlsParameters;
        iceParameters: IceParameters;
    }, () => void, (error: Error) => void];
    '@icecandidate': [RTCIceCandidate | null];
    '@icegatheringstatechange': [IceGatheringState];
    '@iceconnectionstatechange': [IceConnectionState];
};
export declare abstract class HandlerInterface extends EnhancedEventEmitter<HandlerEvents> {
    closed: boolean;
    protected _sendingRtpParametersByKind?: {
        [key: string]: RtpParameters;
    };
    protected _sendingRemoteRtpParametersByKind?: {
        [key: string]: RtpParameters;
    };
    protected _direction?: 'send' | 'recv';
    protected readonly _mapMidTransceiver: Map<string, RTCRtpTransceiver>;
    protected _remoteSdp?: RemoteSdp;
    pc: RTCPeerConnection;
    protected readonly _sendStream: MediaStream;
    protected _hasDataChannelMediaSection: boolean;
    protected _transportReady: boolean;
    protected _transportSetup: boolean;
    abstract get name(): string;
    run({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, extendedRtpCapabilities, }: HandlerRunOptions): void;
    close(): void;
    abstract getNativeRtpCapabilities(): Promise<RtpCapabilities>;
    abstract getNativeSctpCapabilities(): Promise<SctpCapabilities>;
    updateIceServers(iceServers: RTCIceServer[]): Promise<void>;
    restartIce(iceParameters: IceParameters): Promise<void>;
    getTransportStats(): Promise<RTCStatsReport>;
    send({ track, codecOptions, codec }: HandlerSendOptions): Promise<HandlerSendResult>;
    stopSending(localId: string): Promise<void>;
    pauseSending(localId: string): Promise<void>;
    resumeSending(localId: string): Promise<void>;
    replaceTrack(localId: string, track: MediaStreamTrack | null): Promise<void>;
    getSenderStats(localId: string): Promise<RTCStatsReport>;
    abstract sendDataChannel(options: HandlerSendDataChannelOptions): Promise<HandlerSendDataChannelResult>;
    receive(optionsList: HandlerReceiveOptions[]): Promise<HandlerReceiveResult[]>;
    pauseReceiving(localIds: string[]): Promise<void>;
    resumeReceiving(localIds: string[]): Promise<void>;
    getReceiverStats(localId: string): Promise<RTCStatsReport>;
    stopReceiving(localIds: string[]): Promise<void>;
    receiveDataChannel({ sctpStreamParameters, label, protocol, }: HandlerReceiveDataChannelOptions): Promise<HandlerReceiveDataChannelResult>;
    onRemoteIceCandidate(candidate: RTCIceCandidate | null): Promise<void>;
    connect({ dtlsParameters, iceParameters }: {
        dtlsParameters: DtlsParameters;
        iceParameters: IceParameters;
    }): Promise<void>;
    protected setupTransport({ localDtlsRole, localSdpObject }: {
        localDtlsRole: DtlsRole;
        localSdpObject?: sdpTransform.SessionDescription;
    }): Promise<void>;
    protected assertNotClosed(): void;
    protected assertSendDirection(): void;
    protected assertRecvDirection(): void;
}
//# sourceMappingURL=HandlerInterface.d.ts.map