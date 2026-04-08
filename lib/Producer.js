"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Producer = void 0;
const Logger_1 = require("./Logger");
const EnhancedEventEmitter_1 = require("./EnhancedEventEmitter");
const errors_1 = require("./errors");
const logger = new Logger_1.Logger('Producer');
class Producer extends EnhancedEventEmitter_1.EnhancedEventEmitter {
    constructor({ id, localId, rtpSender, track, rtpParameters, stopTracks, disableTrackOnPause, zeroRtpOnPause, appData, }) {
        super();
        this.closed = false;
        this.observer = new EnhancedEventEmitter_1.EnhancedEventEmitter();
        logger.debug('constructor()');
        this.id = id;
        this.localId = localId;
        this.rtpSender = rtpSender;
        this.track = track;
        this.kind = track.kind;
        this.rtpParameters = rtpParameters;
        this.paused = disableTrackOnPause ? !track.enabled : false;
        this.stopTracks = stopTracks;
        this.disableTrackOnPause = disableTrackOnPause;
        this.zeroRtpOnPause = zeroRtpOnPause;
        this.appData = appData || {};
        this.onTrackEnded = this.onTrackEnded.bind(this);
        this.handleTrack();
    }
    /**
     * Closes the Producer.
     */
    close() {
        if (this.closed) {
            return;
        }
        logger.debug('close()');
        this.closed = true;
        this.destroyTrack();
        this.emit('@close');
        this.observer.safeEmit('close');
    }
    /**
     * Transport was closed.
     */
    transportClosed() {
        if (this.closed) {
            return;
        }
        logger.debug('transportClosed()');
        this.closed = true;
        this.destroyTrack();
        this.safeEmit('transportclose');
        this.observer.safeEmit('close');
    }
    /**
     * Get associated RTCRtpSender stats.
     */
    async getStats() {
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        return new Promise((resolve, reject) => this.safeEmit('@getstats', resolve, reject));
    }
    /**
     * Pauses sending media.
     */
    pause() {
        logger.debug('pause()');
        if (this.closed) {
            return logger.error('pause() | Producer closed');
        }
        this.paused = true;
        if (this.track && this.disableTrackOnPause) {
            this.track.enabled = false;
        }
        if (this.zeroRtpOnPause) {
            new Promise((resolve, reject) => this.safeEmit('@pause', resolve, reject)).catch(() => { });
        }
        this.observer.safeEmit('pause');
    }
    /**
     * Resumes sending media.
     */
    resume() {
        logger.debug('resume()');
        if (this.closed) {
            return logger.error('resume() | Producer closed');
        }
        this.paused = false;
        if (this.track && this.disableTrackOnPause) {
            this.track.enabled = true;
        }
        if (this.zeroRtpOnPause) {
            new Promise((resolve, reject) => this.safeEmit('@resume', resolve, reject)).catch(() => { });
        }
        this.observer.safeEmit('resume');
    }
    /**
     * Replaces the current track with a new one or null.
     */
    async replaceTrack({ track }) {
        logger.debug('replaceTrack() [track:%o]', track);
        if (this.closed) {
            if (track && this.stopTracks) {
                try {
                    track.stop();
                }
                catch (error) { }
            }
            throw new errors_1.InvalidStateError('closed');
        }
        else if (track && track.readyState === 'ended') {
            throw new errors_1.InvalidStateError('track ended');
        }
        if (track === this.track) {
            return logger.debug('replaceTrack() | same track, ignored');
        }
        await new Promise((resolve, reject) => this.safeEmit('@replacetrack', track, resolve, reject));
        this.destroyTrack();
        this.track = track;
        if (this.track && this.disableTrackOnPause) {
            this.track.enabled = !this.paused;
        }
        this.handleTrack();
    }
    onTrackEnded() {
        logger.debug('track "ended" event');
        this.safeEmit('trackended');
        this.observer.safeEmit('trackended');
    }
    handleTrack() {
        if (!this.track) {
            return;
        }
        this.track.addEventListener('ended', this.onTrackEnded);
    }
    destroyTrack() {
        if (!this.track) {
            return;
        }
        try {
            this.track.removeEventListener('ended', this.onTrackEnded);
            if (this.stopTracks) {
                this.track.stop();
            }
        }
        catch (error) { }
    }
}
exports.Producer = Producer;
