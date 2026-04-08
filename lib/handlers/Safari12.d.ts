import { HandlerFactory, HandlerInterface, HandlerSendDataChannelOptions, HandlerSendDataChannelResult } from './HandlerInterface';
import { RtpCapabilities } from '../RtpParameters';
import { SctpCapabilities } from '../SctpParameters';
export declare class Safari12 extends HandlerInterface {
    private _nextSendSctpStreamId;
    static createFactory(): HandlerFactory;
    get name(): string;
    getNativeRtpCapabilities(): Promise<RtpCapabilities>;
    getNativeSctpCapabilities(): Promise<SctpCapabilities>;
    sendDataChannel({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol }: HandlerSendDataChannelOptions): Promise<HandlerSendDataChannelResult>;
}
//# sourceMappingURL=Safari12.d.ts.map