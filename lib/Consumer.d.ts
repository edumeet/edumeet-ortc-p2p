import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { MediaKind, RtpParameters } from './RtpParameters';
import { AppData } from './types';
export type ConsumerOptions<ConsumerAppData extends AppData = AppData> = {
    id: string;
    kind: 'audio' | 'video';
    rtpParameters: RtpParameters;
    streamId?: string;
    appData?: ConsumerAppData;
};
export type ConsumerEvents = {
    transportclose: [];
    trackended: [];
    '@getstats': [(stats: RTCStatsReport) => void, (error: Error) => void];
    '@close': [];
    '@pause': [];
    '@resume': [];
};
export type ConsumerObserverEvents = {
    close: [];
    pause: [];
    resume: [];
    trackended: [];
};
export declare class Consumer<ConsumerAppData extends AppData = AppData> extends EnhancedEventEmitter<ConsumerEvents> {
    readonly id: string;
    readonly localId: string;
    closed: boolean;
    readonly rtpReceiver?: RTCRtpReceiver;
    readonly track: MediaStreamTrack;
    readonly rtpParameters: RtpParameters;
    paused: boolean;
    appData: ConsumerAppData;
    readonly observer: EnhancedEventEmitter<ConsumerObserverEvents>;
    constructor({ id, localId, rtpReceiver, track, rtpParameters, appData, }: {
        id: string;
        localId: string;
        rtpReceiver?: RTCRtpReceiver;
        track: MediaStreamTrack;
        rtpParameters: RtpParameters;
        appData?: ConsumerAppData;
    });
    /**
     * Media kind.
     */
    get kind(): MediaKind;
    /**
     * Closes the Consumer.
     */
    close(): void;
    /**
     * Transport was closed.
     */
    transportClosed(): void;
    /**
     * Get associated RTCRtpReceiver stats.
     */
    getStats(): Promise<RTCStatsReport>;
    /**
     * Pauses receiving media.
     */
    pause(): void;
    /**
     * Resumes receiving media.
     */
    resume(): void;
    private onTrackEnded;
    private handleTrack;
    private destroyTrack;
}
//# sourceMappingURL=Consumer.d.ts.map