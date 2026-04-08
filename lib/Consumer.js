"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Consumer = void 0;
const Logger_1 = require("./Logger");
const EnhancedEventEmitter_1 = require("./EnhancedEventEmitter");
const errors_1 = require("./errors");
const logger = new Logger_1.Logger('Consumer');
class Consumer extends EnhancedEventEmitter_1.EnhancedEventEmitter {
    constructor({ id, localId, rtpReceiver, track, rtpParameters, appData, }) {
        super();
        // Closed flag.
        this.closed = false;
        // Observer instance.
        this.observer = new EnhancedEventEmitter_1.EnhancedEventEmitter();
        logger.debug('constructor()');
        this.id = id;
        this.localId = localId;
        this.rtpReceiver = rtpReceiver;
        this.track = track;
        this.rtpParameters = rtpParameters;
        this.paused = !track.enabled;
        this.appData = appData || {};
        this.onTrackEnded = this.onTrackEnded.bind(this);
        this.handleTrack();
    }
    /**
     * Media kind.
     */
    get kind() {
        return this.track.kind;
    }
    /**
     * Closes the Consumer.
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
     * Get associated RTCRtpReceiver stats.
     */
    async getStats() {
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        return new Promise((resolve, reject) => this.safeEmit('@getstats', resolve, reject));
    }
    /**
     * Pauses receiving media.
     */
    pause() {
        logger.debug('pause()');
        if (this.closed) {
            return logger.error('pause() | Consumer closed');
        }
        if (this.paused) {
            return logger.debug('pause() | Consumer is already paused');
        }
        this.paused = true;
        this.track.enabled = false;
        this.emit('@pause');
        this.observer.safeEmit('pause');
    }
    /**
     * Resumes receiving media.
     */
    resume() {
        logger.debug('resume()');
        if (this.closed) {
            return logger.error('resume() | Consumer closed');
        }
        if (!this.paused) {
            return logger.debug('resume() | Consumer is already resumed');
        }
        this.paused = false;
        this.track.enabled = true;
        this.emit('@resume');
        this.observer.safeEmit('resume');
    }
    onTrackEnded() {
        logger.debug('track "ended" event');
        this.safeEmit('trackended');
        this.observer.safeEmit('trackended');
    }
    handleTrack() {
        this.track.addEventListener('ended', this.onTrackEnded);
    }
    destroyTrack() {
        try {
            this.track.removeEventListener('ended', this.onTrackEnded);
            this.track.stop();
        }
        catch (error) { }
    }
}
exports.Consumer = Consumer;
