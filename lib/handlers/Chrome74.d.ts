import { HandlerFactory, HandlerInterface, HandlerSendDataChannelOptions, HandlerSendDataChannelResult } from './HandlerInterface';
import { RtpCapabilities } from '../RtpParameters';
import { SctpCapabilities } from '../SctpParameters';
export declare class Chrome74 extends HandlerInterface {
    private _nextSendSctpStreamId;
    static createFactory(): HandlerFactory;
    get name(): string;
    getNativeRtpCapabilities(): Promise<RtpCapabilities>;
    getNativeSctpCapabilities(): Promise<SctpCapabilities>;
    sendDataChannel({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol, }: HandlerSendDataChannelOptions): Promise<HandlerSendDataChannelResult>;
}
//# sourceMappingURL=Chrome74.d.ts.map