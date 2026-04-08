"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transport = void 0;
const awaitqueue_1 = require("awaitqueue");
const uuid_1 = require("uuid");
const queue_microtask_1 = __importDefault(require("queue-microtask"));
const Logger_1 = require("./Logger");
const EnhancedEventEmitter_1 = require("./EnhancedEventEmitter");
const errors_1 = require("./errors");
const utils = __importStar(require("./utils"));
const ortc = __importStar(require("./ortc"));
const Producer_1 = require("./Producer");
const Consumer_1 = require("./Consumer");
const DataProducer_1 = require("./DataProducer");
const DataConsumer_1 = require("./DataConsumer");
const logger = new Logger_1.Logger('Transport');
class ConsumerCreationTask {
    constructor(consumerOptions) {
        this.consumerOptions = consumerOptions;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}
class Transport extends EnhancedEventEmitter_1.EnhancedEventEmitter {
    constructor({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, handlerFactory, extendedRtpCapabilities, canProduceByKind, }) {
        super();
        this.closed = false;
        this.iceGatheringState = 'new';
        this.iceConnectionState = 'new';
        this._producers = new Map();
        this._consumers = new Map();
        this._dataProducers = new Map();
        this._dataConsumers = new Map();
        this._awaitQueue = new awaitqueue_1.AwaitQueue();
        this._pendingConsumerTasks = [];
        this._consumerCreationInProgress = false;
        this._pendingPauseConsumers = new Map();
        this._consumerPauseInProgress = false;
        this._pendingResumeConsumers = new Map();
        this._consumerResumeInProgress = false;
        this._pendingCloseConsumers = new Map();
        this._consumerCloseInProgress = false;
        this.observer = new EnhancedEventEmitter_1.EnhancedEventEmitter();
        logger.debug('constructor() [direction:%s]', direction);
        this.id = (0, uuid_1.v4)();
        this.direction = direction;
        this.extendedRtpCapabilities = extendedRtpCapabilities;
        this.canProduceByKind = canProduceByKind;
        this.maxSctpMessageSize = sctpParameters ? sctpParameters.maxMessageSize : null;
        // Clone and sanitize additionalSettings.
        additionalSettings = utils.clone(additionalSettings) || {};
        delete additionalSettings.iceServers;
        delete additionalSettings.iceTransportPolicy;
        delete additionalSettings.bundlePolicy;
        delete additionalSettings.rtcpMuxPolicy;
        delete additionalSettings.sdpSemantics;
        this.handler = handlerFactory();
        this.handler.run({
            direction,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
            iceServers,
            iceTransportPolicy,
            additionalSettings,
            extendedRtpCapabilities,
        });
        this.appData = appData || {};
        this.handleHandler();
    }
    /**
     * Close the Transport.
     */
    close() {
        if (this.closed) {
            return;
        }
        logger.debug('close()');
        this.closed = true;
        // Stop the AwaitQueue.
        this._awaitQueue.stop();
        // Close the handler.
        this.handler.close();
        // Change connection state to 'closed' since the handler may not emit
        // '@connectionstatechange' event.
        this.iceConnectionState = 'closed';
        // Close all Producers.
        for (const producer of this._producers.values()) {
            producer.transportClosed();
        }
        this._producers.clear();
        // Close all Consumers.
        for (const consumer of this._consumers.values()) {
            consumer.transportClosed();
        }
        this._consumers.clear();
        // Close all DataProducers.
        for (const dataProducer of this._dataProducers.values()) {
            dataProducer.transportClosed();
        }
        this._dataProducers.clear();
        // Close all DataConsumers.
        for (const dataConsumer of this._dataConsumers.values()) {
            dataConsumer.transportClosed();
        }
        this._dataConsumers.clear();
        // Emit observer event.
        this.observer.safeEmit('close');
    }
    /**
     * Get associated Transport (RTCPeerConnection) stats.
     *
     * @returns {RTCStatsReport}
     */
    async getStats() {
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        return this.handler.getTransportStats();
    }
    /**
     * Restart ICE connection.
     */
    async restartIce({ iceParameters }) {
        logger.debug('restartIce()');
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (!iceParameters) {
            throw new TypeError('missing iceParameters');
        }
        // Enqueue command.
        return this._awaitQueue.push(async () => await this.handler.restartIce(iceParameters), 'transport.restartIce()');
    }
    /**
     * Update ICE servers.
     */
    async updateIceServers({ iceServers } = {}) {
        logger.debug('updateIceServers()');
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (!Array.isArray(iceServers)) {
            throw new TypeError('missing iceServers');
        }
        // Enqueue command.
        return this._awaitQueue.push(async () => this.handler.updateIceServers(iceServers), 'transport.updateIceServers()');
    }
    /**
     * Add a new ICE candidate from the remote endpoint.
     */
    async addIceCandidate({ candidate }) {
        logger.debug('addIceCandidate()');
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        // Enqueue command.
        return this._awaitQueue.push(async () => await this.handler.onRemoteIceCandidate(candidate), 'transport.addIceCandidate()');
    }
    /**
     * Connect the Transport.
     */
    async connect({ dtlsParameters, iceParameters }) {
        logger.debug('connect()');
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (!dtlsParameters) {
            throw new TypeError('missing dtlsParameters');
        }
        else if (!iceParameters) {
            throw new TypeError('missing iceParameters');
        }
        // Enqueue command.
        return this._awaitQueue.push(async () => await this.handler.connect({ dtlsParameters, iceParameters }), 'transport.connect()');
    }
    /**
     * Create a Producer.
     */
    async produce({ track, codecOptions, codec, stopTracks = true, disableTrackOnPause = true, zeroRtpOnPause = false, appData = {}, } = {}) {
        logger.debug('produce() [track:%o]', track);
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (!track) {
            throw new TypeError('missing track');
        }
        else if (this.direction !== 'send') {
            throw new errors_1.UnsupportedError('not a sending Transport');
        }
        else if (!this.canProduceByKind[track.kind]) {
            throw new errors_1.UnsupportedError(`cannot produce ${track.kind}`);
        }
        else if (track.readyState === 'ended') {
            throw new errors_1.InvalidStateError('track ended');
        }
        else if (this.listenerCount('connect') === 0 && this.iceConnectionState === 'new') {
            throw new TypeError('no "connect" listener set into this transport');
        }
        else if (this.listenerCount('produce') === 0) {
            throw new TypeError('no "produce" listener set into this transport');
        }
        else if (appData && typeof appData !== 'object') {
            throw new TypeError('if given, appData must be an object');
        }
        // Enqueue command.
        return (this._awaitQueue
            .push(async () => {
            const { id, localId, rtpParameters, rtpSender } = await this.handler.send({ track, codecOptions, codec });
            try {
                // This will fill rtpParameters's missing fields with default values.
                ortc.validateRtpParameters(rtpParameters);
                this.safeEmit('produce', { id, kind: track.kind, rtpParameters, appData });
                const producer = new Producer_1.Producer({
                    id,
                    localId,
                    rtpSender,
                    track,
                    rtpParameters,
                    stopTracks,
                    disableTrackOnPause,
                    zeroRtpOnPause,
                    appData,
                });
                this._producers.set(producer.id, producer);
                this.handleProducer(producer);
                // Emit observer event.
                this.observer.safeEmit('newproducer', producer);
                return producer;
            }
            catch (error) {
                this.handler.stopSending(localId).catch(() => { });
                throw error;
            }
        }, 'transport.produce()')
            // This catch is needed to stop the given track if the command above
            // failed due to closed Transport.
            .catch((error) => {
            if (stopTracks) {
                try {
                    track.stop();
                }
                catch (error2) { }
            }
            throw error;
        }));
    }
    /**
     * Create a Consumer to consume a remote Producer.
     */
    async consume({ id, kind, rtpParameters, streamId, appData = {}, }) {
        logger.debug('consume()');
        rtpParameters = utils.clone(rtpParameters);
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (this.direction !== 'recv') {
            throw new errors_1.UnsupportedError('not a receiving Transport');
        }
        else if (typeof id !== 'string') {
            throw new TypeError('missing id');
        }
        else if (kind !== 'audio' && kind !== 'video') {
            throw new TypeError(`invalid kind '${kind}'`);
        }
        else if (this.listenerCount('connect') === 0 && this.iceConnectionState === 'new') {
            throw new TypeError('no "connect" listener set into this transport');
        }
        else if (appData && typeof appData !== 'object') {
            throw new TypeError('if given, appData must be an object');
        }
        // Ensure the device can consume it.
        const canConsume = ortc.canReceive(rtpParameters, this.extendedRtpCapabilities);
        if (!canConsume) {
            throw new errors_1.UnsupportedError('cannot consume this Producer');
        }
        const consumerCreationTask = new ConsumerCreationTask({
            id,
            kind,
            rtpParameters,
            streamId,
            appData,
        });
        // Store the Consumer creation task.
        this._pendingConsumerTasks.push(consumerCreationTask);
        // There is no Consumer creation in progress, create it now.
        (0, queue_microtask_1.default)(() => {
            if (this.closed) {
                return;
            }
            if (this._consumerCreationInProgress === false) {
                this.createPendingConsumers();
            }
        });
        return consumerCreationTask.promise;
    }
    /**
     * Create a DataProducer
     */
    async produceData({ ordered = true, maxPacketLifeTime, maxRetransmits, label = '', protocol = '', appData = {}, } = {}) {
        logger.debug('produceData()');
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (this.direction !== 'send') {
            throw new errors_1.UnsupportedError('not a sending Transport');
        }
        else if (!this.maxSctpMessageSize) {
            throw new errors_1.UnsupportedError('SCTP not enabled by remote Transport');
        }
        else if (this.listenerCount('connect') === 0 && this.iceConnectionState === 'new') {
            throw new TypeError('no "connect" listener set into this transport');
        }
        else if (this.listenerCount('producedata') === 0) {
            throw new TypeError('no "producedata" listener set into this transport');
        }
        else if (appData && typeof appData !== 'object') {
            throw new TypeError('if given, appData must be an object');
        }
        if (maxPacketLifeTime || maxRetransmits) {
            ordered = false;
        }
        // Enqueue command.
        return this._awaitQueue.push(async () => {
            const { dataChannel, sctpStreamParameters } = await this.handler.sendDataChannel({ ordered, maxPacketLifeTime, maxRetransmits, label, protocol });
            // This will fill sctpStreamParameters's missing fields with default values.
            ortc.validateSctpStreamParameters(sctpStreamParameters);
            const { id } = await new Promise((resolve, reject) => {
                this.safeEmit('producedata', { sctpStreamParameters, label, protocol, appData }, resolve, reject);
            });
            const dataProducer = new DataProducer_1.DataProducer({ id, dataChannel, sctpStreamParameters, appData });
            this._dataProducers.set(dataProducer.id, dataProducer);
            this.handleDataProducer(dataProducer);
            // Emit observer event.
            this.observer.safeEmit('newdataproducer', dataProducer);
            return dataProducer;
        }, 'transport.produceData()');
    }
    /**
     * Create a DataConsumer
     */
    async consumeData({ id, dataProducerId, sctpStreamParameters, label = '', protocol = '', appData = {}, }) {
        logger.debug('consumeData()');
        sctpStreamParameters = utils.clone(sctpStreamParameters);
        if (this.closed) {
            throw new errors_1.InvalidStateError('closed');
        }
        else if (this.direction !== 'recv') {
            throw new errors_1.UnsupportedError('not a receiving Transport');
        }
        else if (!this.maxSctpMessageSize) {
            throw new errors_1.UnsupportedError('SCTP not enabled by remote Transport');
        }
        else if (typeof id !== 'string') {
            throw new TypeError('missing id');
        }
        else if (typeof dataProducerId !== 'string') {
            throw new TypeError('missing dataProducerId');
        }
        else if (this.listenerCount('connect') === 0 && this.iceConnectionState === 'new') {
            throw new TypeError('no "connect" listener set into this transport');
        }
        else if (appData && typeof appData !== 'object') {
            throw new TypeError('if given, appData must be an object');
        }
        // This may throw.
        ortc.validateSctpStreamParameters(sctpStreamParameters);
        // Enqueue command.
        return this._awaitQueue.push(async () => {
            const { dataChannel } = await this.handler.receiveDataChannel({ sctpStreamParameters, label, protocol });
            const dataConsumer = new DataConsumer_1.DataConsumer({
                id,
                dataProducerId,
                dataChannel,
                sctpStreamParameters,
                appData,
            });
            this._dataConsumers.set(dataConsumer.id, dataConsumer);
            this.handleDataConsumer(dataConsumer);
            // Emit observer event.
            this.observer.safeEmit('newdataconsumer', dataConsumer);
            return dataConsumer;
        }, 'transport.consumeData()');
    }
    // This method is guaranteed to never throw.
    async createPendingConsumers() {
        this._consumerCreationInProgress = true;
        this._awaitQueue
            .push(async () => {
            if (this._pendingConsumerTasks.length === 0) {
                logger.debug('createPendingConsumers() | there is no Consumer to be created');
                return;
            }
            const pendingConsumerTasks = [...this._pendingConsumerTasks];
            // Clear pending Consumer tasks.
            this._pendingConsumerTasks = [];
            // Fill options list.
            const optionsList = [];
            for (const task of pendingConsumerTasks) {
                const { id, kind, rtpParameters, streamId } = task.consumerOptions;
                optionsList.push({ trackId: id, kind: kind, rtpParameters, streamId });
            }
            try {
                const results = await this.handler.receive(optionsList);
                for (let idx = 0; idx < results.length; ++idx) {
                    const task = pendingConsumerTasks[idx];
                    const result = results[idx];
                    const { id, rtpParameters, appData } = task.consumerOptions;
                    const { localId, rtpReceiver, track } = result;
                    const consumer = new Consumer_1.Consumer({
                        id: id,
                        localId,
                        rtpReceiver,
                        track,
                        rtpParameters,
                        appData: appData,
                    });
                    this._consumers.set(consumer.id, consumer);
                    this.handleConsumer(consumer);
                    // Emit observer event.
                    this.observer.safeEmit('newconsumer', consumer);
                    task.resolve(consumer);
                }
            }
            catch (error) {
                for (const task of pendingConsumerTasks) {
                    task.reject(error);
                }
            }
        }, 'transport.createPendingConsumers()')
            .then(() => {
            this._consumerCreationInProgress = false;
            // There are pending Consumer tasks, enqueue their creation.
            if (this._pendingConsumerTasks.length > 0) {
                this.createPendingConsumers();
            }
        })
            // NOTE: We only get here when the await queue is closed.
            .catch(() => { });
    }
    pausePendingConsumers() {
        this._consumerPauseInProgress = true;
        this._awaitQueue
            .push(async () => {
            if (this._pendingPauseConsumers.size === 0) {
                logger.debug('pausePendingConsumers() | there is no Consumer to be paused');
                return;
            }
            const pendingPauseConsumers = Array.from(this._pendingPauseConsumers.values());
            // Clear pending pause Consumer map.
            this._pendingPauseConsumers.clear();
            try {
                const localIds = pendingPauseConsumers.map((consumer) => consumer.localId);
                await this.handler.pauseReceiving(localIds);
            }
            catch (error) {
                logger.error('pausePendingConsumers() | failed to pause Consumers:', error);
            }
        }, 'transport.pausePendingConsumers')
            .then(() => {
            this._consumerPauseInProgress = false;
            // There are pending Consumers to be paused, do it.
            if (this._pendingPauseConsumers.size > 0) {
                this.pausePendingConsumers();
            }
        })
            // NOTE: We only get here when the await queue is closed.
            .catch(() => { });
    }
    resumePendingConsumers() {
        this._consumerResumeInProgress = true;
        this._awaitQueue
            .push(async () => {
            if (this._pendingResumeConsumers.size === 0) {
                logger.debug('resumePendingConsumers() | there is no Consumer to be resumed');
                return;
            }
            const pendingResumeConsumers = Array.from(this._pendingResumeConsumers.values());
            // Clear pending resume Consumer map.
            this._pendingResumeConsumers.clear();
            try {
                const localIds = pendingResumeConsumers.map((consumer) => consumer.localId);
                await this.handler.resumeReceiving(localIds);
            }
            catch (error) {
                logger.error('resumePendingConsumers() | failed to resume Consumers:', error);
            }
        }, 'transport.resumePendingConsumers')
            .then(() => {
            this._consumerResumeInProgress = false;
            // There are pending Consumer to be resumed, do it.
            if (this._pendingResumeConsumers.size > 0) {
                this.resumePendingConsumers();
            }
        })
            // NOTE: We only get here when the await queue is closed.
            .catch(() => { });
    }
    closePendingConsumers() {
        this._consumerCloseInProgress = true;
        this._awaitQueue
            .push(async () => {
            if (this._pendingCloseConsumers.size === 0) {
                logger.debug('closePendingConsumers() | there is no Consumer to be closed');
                return;
            }
            const pendingCloseConsumers = Array.from(this._pendingCloseConsumers.values());
            // Clear pending close Consumer map.
            this._pendingCloseConsumers.clear();
            try {
                await this.handler.stopReceiving(pendingCloseConsumers.map((consumer) => consumer.localId));
            }
            catch (error) {
                logger.error('closePendingConsumers() | failed to close Consumers:', error);
            }
        }, 'transport.closePendingConsumers')
            .then(() => {
            this._consumerCloseInProgress = false;
            // There are pending Consumer to be resumed, do it.
            if (this._pendingCloseConsumers.size > 0) {
                this.closePendingConsumers();
            }
        })
            // NOTE: We only get here when the await queue is closed.
            .catch(() => { });
    }
    handleHandler() {
        const handler = this.handler;
        handler.on('@connect', ({ dtlsParameters, iceParameters }, callback, errback) => {
            if (this.closed) {
                errback(new errors_1.InvalidStateError('closed'));
                return;
            }
            this.safeEmit('connect', { dtlsParameters, iceParameters }, callback, errback);
        });
        handler.on('@icecandidate', (candidate) => {
            if (!this.closed) {
                this.safeEmit('icecandidate', candidate);
            }
        });
        handler.on('@icegatheringstatechange', (iceGatheringState) => {
            if (iceGatheringState === this.iceGatheringState) {
                return;
            }
            logger.debug('ICE gathering state changed to %s', iceGatheringState);
            this.iceGatheringState = iceGatheringState;
            if (!this.closed) {
                this.safeEmit('icegatheringstatechange', iceGatheringState);
            }
        });
        handler.on('@iceconnectionstatechange', (iceConnectionState) => {
            if (iceConnectionState === this.iceConnectionState) {
                return;
            }
            logger.debug('connection state changed to %s', iceConnectionState);
            this.iceConnectionState = iceConnectionState;
            if (!this.closed) {
                this.safeEmit('iceconnectionstatechange', iceConnectionState);
            }
        });
    }
    handleProducer(producer) {
        producer.on('@close', () => {
            this._producers.delete(producer.id);
            if (this.closed) {
                return;
            }
            this._awaitQueue
                .push(async () => await this.handler.stopSending(producer.localId), 'producer @close event')
                .catch((error) => logger.warn('producer.close() failed:%o', error));
        });
        producer.on('@pause', (callback, errback) => {
            this._awaitQueue
                .push(async () => await this.handler.pauseSending(producer.localId), 'producer @pause event')
                .then(callback)
                .catch(errback);
        });
        producer.on('@resume', (callback, errback) => {
            this._awaitQueue
                .push(async () => await this.handler.resumeSending(producer.localId), 'producer @resume event')
                .then(callback)
                .catch(errback);
        });
        producer.on('@replacetrack', (track, callback, errback) => {
            this._awaitQueue
                .push(async () => await this.handler.replaceTrack(producer.localId, track), 'producer @replacetrack event')
                .then(callback)
                .catch(errback);
        });
        producer.on('@getstats', (callback, errback) => {
            if (this.closed) {
                return errback(new errors_1.InvalidStateError('closed'));
            }
            this.handler
                .getSenderStats(producer.localId)
                .then(callback)
                .catch(errback);
        });
    }
    handleConsumer(consumer) {
        consumer.on('@close', () => {
            this._consumers.delete(consumer.id);
            this._pendingPauseConsumers.delete(consumer.id);
            this._pendingResumeConsumers.delete(consumer.id);
            if (this.closed) {
                return;
            }
            // Store the Consumer into the close list.
            this._pendingCloseConsumers.set(consumer.id, consumer);
            // There is no Consumer close in progress, do it now.
            if (this._consumerCloseInProgress === false) {
                this.closePendingConsumers();
            }
        });
        consumer.on('@pause', () => {
            // If Consumer is pending to be resumed, remove from pending resume list.
            if (this._pendingResumeConsumers.has(consumer.id)) {
                this._pendingResumeConsumers.delete(consumer.id);
            }
            // Store the Consumer into the pending list.
            this._pendingPauseConsumers.set(consumer.id, consumer);
            // There is no Consumer pause in progress, do it now.
            (0, queue_microtask_1.default)(() => {
                if (this.closed) {
                    return;
                }
                if (this._consumerPauseInProgress === false) {
                    this.pausePendingConsumers();
                }
            });
        });
        consumer.on('@resume', () => {
            // If Consumer is pending to be paused, remove from pending pause list.
            if (this._pendingPauseConsumers.has(consumer.id)) {
                this._pendingPauseConsumers.delete(consumer.id);
            }
            // Store the Consumer into the pending list.
            this._pendingResumeConsumers.set(consumer.id, consumer);
            // There is no Consumer resume in progress, do it now.
            (0, queue_microtask_1.default)(() => {
                if (this.closed) {
                    return;
                }
                if (this._consumerResumeInProgress === false) {
                    this.resumePendingConsumers();
                }
            });
        });
        consumer.on('@getstats', (callback, errback) => {
            if (this.closed) {
                return errback(new errors_1.InvalidStateError('closed'));
            }
            this.handler
                .getReceiverStats(consumer.localId)
                .then(callback)
                .catch(errback);
        });
    }
    handleDataProducer(dataProducer) {
        dataProducer.on('@close', () => this._dataProducers.delete(dataProducer.id));
    }
    handleDataConsumer(dataConsumer) {
        dataConsumer.on('@close', () => this._dataConsumers.delete(dataConsumer.id));
    }
}
exports.Transport = Transport;
