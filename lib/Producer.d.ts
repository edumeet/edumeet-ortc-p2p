import { EnhancedEventEmitter } from './EnhancedEventEmitter';
import { MediaKind, RtpCodecCapability, RtpParameters } from './RtpParameters';
import { AppData } from './types';
export type ProducerOptions<ProducerAppData extends AppData = AppData> = {
    track?: MediaStreamTrack;
    codecOptions?: ProducerCodecOptions;
    codec?: RtpCodecCapability;
    stopTracks?: boolean;
    disableTrackOnPause?: boolean;
    zeroRtpOnPause?: boolean;
    appData?: ProducerAppData;
};
export type ProducerCodecOptions = {
    opusStereo?: boolean;
    opusFec?: boolean;
    opusDtx?: boolean;
    opusMaxPlaybackRate?: number;
    opusMaxAverageBitrate?: number;
    opusPtime?: number;
    opusNack?: boolean;
    videoGoogleStartBitrate?: number;
    videoGoogleMaxBitrate?: number;
    videoGoogleMinBitrate?: number;
};
export type ProducerEvents = {
    transportclose: [];
    trackended: [];
    '@pause': [() => void, (error: Error) => void];
    '@resume': [() => void, (error: Error) => void];
    '@replacetrack': [MediaStreamTrack | null, () => void, (error: Error) => void];
    '@getstats': [(stats: RTCStatsReport) => void, (error: Error) => void];
    '@close': [];
};
export type ProducerObserverEvents = {
    close: [];
    pause: [];
    resume: [];
    trackended: [];
};
export declare class Producer<ProducerAppData extends AppData = AppData> extends EnhancedEventEmitter<ProducerEvents> {
    readonly id: string;
    readonly localId: string;
    closed: boolean;
    readonly rtpSender?: RTCRtpSender;
    track: MediaStreamTrack | null;
    readonly kind: MediaKind;
    readonly rtpParameters: RtpParameters;
    paused: boolean;
    stopTracks: boolean;
    disableTrackOnPause: boolean;
    zeroRtpOnPause: boolean;
    appData: ProducerAppData;
    readonly observer: EnhancedEventEmitter<ProducerObserverEvents>;
    constructor({ id, localId, rtpSender, track, rtpParameters, stopTracks, disableTrackOnPause, zeroRtpOnPause, appData, }: {
        id: string;
        localId: string;
        rtpSender?: RTCRtpSender;
        track: MediaStreamTrack;
        rtpParameters: RtpParameters;
        stopTracks: boolean;
        disableTrackOnPause: boolean;
        zeroRtpOnPause: boolean;
        appData?: ProducerAppData;
    });
    /**
     * Closes the Producer.
     */
    close(): void;
    /**
     * Transport was closed.
     */
    transportClosed(): void;
    /**
     * Get associated RTCRtpSender stats.
     */
    getStats(): Promise<RTCStatsReport>;
    /**
     * Pauses sending media.
     */
    pause(): void;
    /**
     * Resumes sending media.
     */
    resume(): void;
    /**
     * Replaces the current track with a new one or null.
     */
    replaceTrack({ track }: {
        track: MediaStreamTrack | null;
    }): Promise<void>;
    private onTrackEnded;
    private handleTrack;
    private destroyTrack;
}
//# sourceMappingURL=Producer.d.ts.map