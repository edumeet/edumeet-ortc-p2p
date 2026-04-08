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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandlerInterface = void 0;
const EnhancedEventEmitter_1 = require("../EnhancedEventEmitter");
const RemoteSdp_1 = require("./sdp/RemoteSdp");
const utils = __importStar(require("../utils"));
const sdpUnifiedPlanUtils = __importStar(require("./sdp/unifiedPlanUtils"));
const ortc = __importStar(require("../ortc"));
const sdpTransform = __importStar(require("sdp-transform"));
const sdpCommonUtils = __importStar(require("./sdp/commonUtils"));
const errors_1 = require("../errors");
const Logger_1 = require("../Logger");
const logger = new Logger_1.Logger('Handler');
class HandlerInterface extends EnhancedEventEmitter_1.EnhancedEventEmitter {
    constructor() {
        super(...arguments);
        // Closed flag.
        this.closed = false;
        // Map of RTCTransceivers indexed by MID.
        this._mapMidTransceiver = new Map();
        // Local stream for sending.
        this._sendStream = new MediaStream();
        // Whether a DataChannel m=application section has been created.
        this._hasDataChannelMediaSection = false;
        // Got transport local and remote parameters.
        this._transportReady = false;
        // Have setup transport local
        this._transportSetup = false;
    }
    run({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, extendedRtpCapabilities, }) {
        this.assertNotClosed();
        this.pc = new RTCPeerConnection({
            iceServers: iceServers || [],
            iceTransportPolicy: iceTransportPolicy || 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            ...additionalSettings,
        });
        this._direction = direction;
        this._remoteSdp = new RemoteSdp_1.RemoteSdp({ iceParameters, iceCandidates, dtlsParameters, sctpParameters });
        this._sendingRtpParametersByKind = {
            audio: ortc.getSendingRtpParameters('audio', extendedRtpCapabilities),
            video: ortc.getSendingRtpParameters('video', extendedRtpCapabilities),
        };
        this._sendingRemoteRtpParametersByKind = {
            audio: ortc.getSendingRemoteRtpParameters('audio', extendedRtpCapabilities),
            video: ortc.getSendingRemoteRtpParameters('video', extendedRtpCapabilities),
        };
        this.pc.addEventListener('icecandidate', ({ candidate }) => this.emit('@icecandidate', candidate));
        this.pc.addEventListener('icegatheringstatechange', () => this.emit('@icegatheringstatechange', this.pc.iceGatheringState));
        this.pc.addEventListener('iceconnectionstatechange', () => this.emit('@iceconnectionstatechange', this.pc.iceConnectionState));
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.pc?.close();
        this.emit('@close');
    }
    async updateIceServers(iceServers) {
        this.assertNotClosed();
        const configuration = this.pc.getConfiguration();
        configuration.iceServers = iceServers;
        this.pc.setConfiguration(configuration);
    }
    async restartIce(iceParameters) {
        this.assertNotClosed();
        this._remoteSdp.updateIceParameters(iceParameters);
        if (!this._transportReady) {
            return;
        }
        if (this._direction === 'send') {
            const offer = await this.pc.createOffer({ iceRestart: true });
            await this.pc.setLocalDescription(offer);
            await this.pc.setRemoteDescription({ type: 'answer', sdp: this._remoteSdp.getSdp() });
        }
        else {
            await this.pc.setRemoteDescription({ type: 'offer', sdp: this._remoteSdp.getSdp() });
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
        }
    }
    async getTransportStats() {
        this.assertNotClosed();
        return this.pc.getStats();
    }
    async send({ track, codecOptions, codec }) {
        this.assertNotClosed();
        this.assertSendDirection();
        const sendingRtpParameters = utils.clone(this._sendingRtpParametersByKind[track.kind]);
        // This may throw.
        sendingRtpParameters.codecs = ortc.reduceCodecs(sendingRtpParameters.codecs, codec);
        const sendingRemoteRtpParameters = utils.clone(this._sendingRemoteRtpParametersByKind[track.kind]);
        // This may throw.
        sendingRemoteRtpParameters.codecs = ortc.reduceCodecs(sendingRemoteRtpParameters.codecs, codec);
        const mediaSectionIdx = this._remoteSdp.getNextMediaSectionIdx();
        const transceiver = this.pc.addTransceiver(track, { direction: 'sendonly', streams: [this._sendStream] });
        const offer = await this.pc.createOffer();
        let localSdpObject = sdpTransform.parse(offer.sdp);
        logger.debug('send() [offer:%s]', offer);
        if (!this._transportSetup) {
            await this.setupTransport({ localDtlsRole: 'client', localSdpObject });
        }
        await this.pc.setLocalDescription(offer);
        const localId = transceiver.mid;
        sendingRtpParameters.mid = localId;
        localSdpObject = sdpTransform.parse(this.pc.localDescription.sdp);
        const offerMediaObject = localSdpObject.media[mediaSectionIdx.idx];
        sendingRtpParameters.rtcp.cname = sdpCommonUtils.getCname({ offerMediaObject });
        sendingRtpParameters.encodings = sdpUnifiedPlanUtils.getRtpEncodings({ offerMediaObject });
        this._remoteSdp.send({
            offerMediaObject,
            reuseMid: mediaSectionIdx.reuseMid,
            offerRtpParameters: sendingRtpParameters,
            answerRtpParameters: sendingRemoteRtpParameters,
            codecOptions,
            extmapAllowMixed: true,
        });
        if (this._transportReady) {
            const answer = this._remoteSdp.getSdp();
            logger.debug('send() [answer:%s]', answer);
            await this.pc.setRemoteDescription({ type: 'answer', sdp: answer });
        }
        this._mapMidTransceiver.set(localId, transceiver);
        return {
            id: track.id,
            localId,
            rtpParameters: sendingRtpParameters,
            rtpSender: transceiver.sender,
        };
    }
    async stopSending(localId) {
        this.assertSendDirection();
        if (this.closed) {
            return;
        }
        const transceiver = this._mapMidTransceiver.get(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        transceiver.sender.replaceTrack(null);
        this.pc.removeTrack(transceiver.sender);
        const mediaSectionClosed = this._remoteSdp.closeMediaSection(transceiver.mid);
        if (mediaSectionClosed) {
            try {
                transceiver.stop();
            }
            catch (error) { }
        }
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.pc.setRemoteDescription({ type: 'answer', sdp: this._remoteSdp.getSdp() });
        this._mapMidTransceiver.delete(localId);
    }
    async pauseSending(localId) {
        this.assertNotClosed();
        this.assertSendDirection();
        const transceiver = this._mapMidTransceiver.get(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        transceiver.direction = 'inactive';
        this._remoteSdp.pauseMediaSection(localId);
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.pc.setRemoteDescription({ type: 'answer', sdp: this._remoteSdp.getSdp() });
    }
    async resumeSending(localId) {
        this.assertNotClosed();
        this.assertSendDirection();
        const transceiver = this._mapMidTransceiver.get(localId);
        this._remoteSdp.resumeSendingMediaSection(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        transceiver.direction = 'sendonly';
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        await this.pc.setRemoteDescription({ type: 'answer', sdp: this._remoteSdp.getSdp() });
    }
    async replaceTrack(localId, track) {
        this.assertNotClosed();
        this.assertSendDirection();
        const transceiver = this._mapMidTransceiver.get(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        await transceiver.sender.replaceTrack(track);
    }
    async getSenderStats(localId) {
        this.assertNotClosed();
        this.assertSendDirection();
        const transceiver = this._mapMidTransceiver.get(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        return transceiver.sender.getStats();
    }
    async receive(optionsList) {
        this.assertNotClosed();
        this.assertRecvDirection();
        const results = [];
        const mapLocalId = new Map();
        for (const options of optionsList) {
            const { trackId, kind, rtpParameters, streamId } = options;
            const localId = rtpParameters.mid || String(this._mapMidTransceiver.size);
            mapLocalId.set(trackId, localId);
            this._remoteSdp.receive({
                mid: localId,
                kind,
                offerRtpParameters: rtpParameters,
                streamId: streamId || rtpParameters.rtcp.cname,
                trackId,
            });
        }
        const offer = this._remoteSdp.getSdp();
        logger.debug('receive() [offer:%s]', offer);
        await this.pc.setRemoteDescription({ type: 'offer', sdp: offer });
        let answer = await this.pc.createAnswer();
        const localSdpObject = sdpTransform.parse(answer.sdp);
        for (const options of optionsList) {
            const { trackId, rtpParameters } = options;
            const localId = mapLocalId.get(trackId);
            const answerMediaObject = localSdpObject.media.find((m) => String(m.mid) === localId);
            sdpCommonUtils.applyCodecParameters({ offerRtpParameters: rtpParameters, answerMediaObject: answerMediaObject });
        }
        answer = { type: 'answer', sdp: sdpTransform.write(localSdpObject) };
        if (!this._transportReady) {
            await this.setupTransport({ localDtlsRole: 'server', localSdpObject });
        }
        logger.debug('receive() [answer:%s]', answer.sdp);
        await this.pc.setLocalDescription(answer);
        for (const options of optionsList) {
            const { trackId } = options;
            const localId = mapLocalId.get(trackId);
            const transceiver = this.pc.getTransceivers().find((t) => t.mid === localId);
            if (!transceiver) {
                throw new Error('new RTCRtpTransceiver not found');
            }
            this._mapMidTransceiver.set(localId, transceiver);
            results.push({ localId, track: transceiver.receiver.track, rtpReceiver: transceiver.receiver });
        }
        return results;
    }
    async pauseReceiving(localIds) {
        this.assertNotClosed();
        this.assertRecvDirection();
        for (const localId of localIds) {
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver) {
                throw new Error('associated RTCRtpTransceiver not found');
            }
            transceiver.direction = 'inactive';
            this._remoteSdp.pauseMediaSection(localId);
        }
        await this.pc.setRemoteDescription({ type: 'offer', sdp: this._remoteSdp.getSdp() });
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
    }
    async resumeReceiving(localIds) {
        this.assertNotClosed();
        this.assertRecvDirection();
        for (const localId of localIds) {
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver) {
                throw new Error('associated RTCRtpTransceiver not found');
            }
            transceiver.direction = 'recvonly';
            this._remoteSdp.resumeReceivingMediaSection(localId);
        }
        await this.pc.setRemoteDescription({ type: 'offer', sdp: this._remoteSdp.getSdp() });
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
    }
    async getReceiverStats(localId) {
        this.assertNotClosed();
        this.assertRecvDirection();
        const transceiver = this._mapMidTransceiver.get(localId);
        if (!transceiver) {
            throw new Error('associated RTCRtpTransceiver not found');
        }
        return transceiver.receiver.getStats();
    }
    async stopReceiving(localIds) {
        this.assertRecvDirection();
        if (this.closed) {
            return;
        }
        for (const localId of localIds) {
            const transceiver = this._mapMidTransceiver.get(localId);
            if (!transceiver) {
                throw new Error('associated RTCRtpTransceiver not found');
            }
            this._remoteSdp.closeMediaSection(transceiver.mid);
        }
        await this.pc.setRemoteDescription({ type: 'offer', sdp: this._remoteSdp.getSdp() });
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        for (const localId of localIds) {
            this._mapMidTransceiver.delete(localId);
        }
    }
    async receiveDataChannel({ sctpStreamParameters, label, protocol, }) {
        this.assertNotClosed();
        this.assertRecvDirection();
        const { streamId, ordered, maxPacketLifeTime, maxRetransmits, } = sctpStreamParameters;
        const options = {
            negotiated: true,
            id: streamId,
            ordered,
            maxPacketLifeTime,
            maxRetransmits,
            protocol,
        };
        const dataChannel = this.pc.createDataChannel(label, options);
        if (!this._hasDataChannelMediaSection) {
            this._remoteSdp.receiveSctpAssociation();
            await this.pc.setRemoteDescription({ type: 'offer', sdp: this._remoteSdp.getSdp() });
            const answer = await this.pc.createAnswer();
            if (!this._transportReady) {
                await this.setupTransport({ localDtlsRole: 'server', localSdpObject: sdpTransform.parse(answer.sdp) });
            }
            await this.pc.setLocalDescription(answer);
            this._hasDataChannelMediaSection = true;
        }
        return { dataChannel };
    }
    async onRemoteIceCandidate(candidate) {
        this.assertNotClosed();
        logger.debug('onRemoteIceCandidate() [candidate:%o]', candidate);
        await this.pc.addIceCandidate(candidate);
    }
    async connect({ dtlsParameters, iceParameters }) {
        this.assertNotClosed();
        logger.debug('connect() [dtlsParameters:%o, iceParameters:%o]', dtlsParameters, iceParameters);
        this._remoteSdp.updateIceParameters(iceParameters);
        this._remoteSdp.updateDtlsParameters(dtlsParameters);
        if (this._direction === 'recv') {
            return;
        }
        await this.pc.setRemoteDescription({ type: 'answer', sdp: this._remoteSdp.getSdp() });
        this._transportReady = true;
    }
    async setupTransport({ localDtlsRole, localSdpObject }) {
        if (!localSdpObject) {
            localSdpObject = sdpTransform.parse(this.pc.localDescription.sdp);
        }
        const dtlsParameters = sdpCommonUtils.extractDtlsParameters({ sdpObject: localSdpObject });
        const iceParameters = sdpCommonUtils.extractIceParameters({ sdpObject: localSdpObject });
        dtlsParameters.role = localDtlsRole;
        await new Promise((resolve, reject) => this.safeEmit('@connect', { dtlsParameters, iceParameters }, resolve, reject));
        if (this._direction === 'recv') {
            this._transportReady = true;
        }
        this._transportSetup = true;
    }
    assertNotClosed() {
        if (this.closed) {
            throw new errors_1.InvalidStateError('method called in a closed handler');
        }
    }
    assertSendDirection() {
        if (this._direction !== 'send') {
            throw new Error('method can just be called for handlers with "send" direction');
        }
    }
    assertRecvDirection() {
        if (this._direction !== 'recv') {
            throw new Error('method can just be called for handlers with "recv" direction');
        }
    }
}
exports.HandlerInterface = HandlerInterface;
