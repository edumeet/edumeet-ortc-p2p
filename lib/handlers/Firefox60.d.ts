import { HandlerFactory, HandlerInterface, HandlerSendOptions, HandlerSendResult, HandlerSendDataChannelOptions, HandlerSendDataChannelResult } from './HandlerInterface';
import { RtpCapabilities } from '../RtpParameters';
import { SctpCapabilities } from '../SctpParameters';
export declare class Firefox60 extends HandlerInterface {
    private _nextSendSctpStreamId;
    static createFactory(): HandlerFactory;
    get name(): string;
    getNativeRtpCapabilities(): Promise<RtpCapabilities>;
    getNativeSctpCapabilities(): Promise<SctpCapabilities>;
    send({ track, codecOptions, codec }: HandlerSendOptions): Promise<HandlerSendResult>;
    stopSending(localId: string): Promise<void>;
    sendDataChannel({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol, }: HandlerSendDataChannelOptions): Promise<HandlerSendDataChannelResult>;
}
//# sourceMappingURL=Firefox60.d.ts.map