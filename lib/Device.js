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
exports.Device = void 0;
exports.detectDevice = detectDevice;
const ua_parser_js_1 = require("ua-parser-js");
const Logger_1 = require("./Logger");
const EnhancedEventEmitter_1 = require("./EnhancedEventEmitter");
const errors_1 = require("./errors");
const utils = __importStar(require("./utils"));
const ortc = __importStar(require("./ortc"));
const Transport_1 = require("./Transport");
const Chrome74_1 = require("./handlers/Chrome74");
const Firefox60_1 = require("./handlers/Firefox60");
const Safari12_1 = require("./handlers/Safari12");
const logger = new Logger_1.Logger('Device');
function detectDevice() {
    if (typeof navigator === 'object' &&
        typeof navigator.userAgent === 'string') {
        const ua = navigator.userAgent;
        const uaParser = new ua_parser_js_1.UAParser(ua);
        logger.debug('detectDevice() | browser detected [ua:%s, parsed:%o]', ua, uaParser.getResult());
        const browser = uaParser.getBrowser();
        const browserName = browser.name?.toLowerCase();
        const browserVersion = parseInt(browser.major ?? '0');
        const engine = uaParser.getEngine();
        const engineName = engine.name?.toLowerCase();
        const os = uaParser.getOS();
        const osName = os.name?.toLowerCase();
        const osVersion = parseFloat(os.version ?? '0');
        const device = uaParser.getDevice();
        const deviceModel = device.model?.toLowerCase();
        const isIOS = osName === 'ios' || deviceModel === 'ipad';
        const isChrome = browserName &&
            [
                'chrome',
                'chromium',
                'mobile chrome',
                'chrome webview',
                'chrome headless',
            ].includes(browserName);
        const isFirefox = browserName &&
            ['firefox', 'mobile firefox', 'mobile focus'].includes(browserName);
        const isSafari = browserName && ['safari', 'mobile safari'].includes(browserName);
        const isEdge = browserName && ['edge'].includes(browserName);
        if ((isChrome && !isIOS && browserVersion >= 74) ||
            (isEdge && !isIOS && browserVersion >= 88)) {
            return 'Chrome74';
        }
        else if (isFirefox && !isIOS && browserVersion >= 60) {
            return 'Firefox60';
        }
        else if (isFirefox && isIOS && osVersion >= 14.3) {
            return 'Safari12';
        }
        else if (isSafari &&
            browserVersion >= 12 &&
            typeof RTCRtpTransceiver !== 'undefined' &&
            RTCRtpTransceiver.prototype.hasOwnProperty('currentDirection')) {
            return 'Safari12';
        }
        else if (engineName === 'webkit' &&
            isIOS &&
            typeof RTCRtpTransceiver !== 'undefined' &&
            RTCRtpTransceiver.prototype.hasOwnProperty('currentDirection')) {
            return 'Safari12';
        }
        else if (engineName === 'blink') {
            return 'Chrome74';
        }
        else {
            logger.warn('detectDevice() | browser not supported [name:%s, version:%s]', browserName, browserVersion);
            return undefined;
        }
    }
    else {
        logger.warn('detectDevice() | unknown device');
        return undefined;
    }
}
class Device {
    constructor({ handlerName, handlerFactory, Handler } = {}) {
        this._loaded = false;
        this._observer = new EnhancedEventEmitter_1.EnhancedEventEmitter();
        this.ready = new Promise((resolve) => {
            this.resolveReady = resolve;
        });
        logger.debug('constructor()');
        // Handle deprecated option.
        if (Handler) {
            logger.warn('constructor() | Handler option is DEPRECATED, use handlerName or handlerFactory instead');
            if (typeof Handler === 'string') {
                handlerName = Handler;
            }
            else {
                throw new TypeError('non string Handler option no longer supported, use handlerFactory instead');
            }
        }
        if (handlerName && handlerFactory) {
            throw new TypeError('just one of handlerName or handlerInterface can be given');
        }
        if (handlerFactory) {
            this._handlerFactory = handlerFactory;
        }
        else {
            if (handlerName) {
                logger.debug('constructor() | handler given: %s', handlerName);
            }
            else {
                handlerName = detectDevice();
                if (handlerName) {
                    logger.debug('constructor() | detected handler: %s', handlerName);
                }
                else {
                    throw new errors_1.UnsupportedError('device not supported');
                }
            }
            switch (handlerName) {
                case 'Chrome74': {
                    this._handlerFactory = Chrome74_1.Chrome74.createFactory();
                    break;
                }
                case 'Firefox60': {
                    this._handlerFactory = Firefox60_1.Firefox60.createFactory();
                    break;
                }
                case 'Safari12': {
                    this._handlerFactory = Safari12_1.Safari12.createFactory();
                    break;
                }
                default: {
                    throw new TypeError(`unknown handlerName "${handlerName}"`);
                }
            }
        }
        // Create a temporal handler to get its name.
        const handler = this._handlerFactory();
        this._handlerName = handler.name;
        handler.close();
        this._extendedRtpCapabilities = undefined;
        this._recvRtpCapabilities = undefined;
        this._canProduceByKind = {
            audio: false,
            video: false,
        };
        this._sctpCapabilities = undefined;
    }
    get handlerName() {
        return this._handlerName;
    }
    get rtpCapabilities() {
        if (!this._loaded) {
            throw new errors_1.InvalidStateError('not loaded');
        }
        return this._recvRtpCapabilities;
    }
    get sctpCapabilities() {
        if (!this._loaded) {
            throw new errors_1.InvalidStateError('not loaded');
        }
        return this._sctpCapabilities;
    }
    get observer() {
        return this._observer;
    }
    async getRtpCapabilities() {
        logger.debug('getRtpCapabilities()');
        return this._handlerFactory().getNativeRtpCapabilities();
    }
    async load({ remoteRtpCapabilities }) {
        logger.debug('load() [remoteRtpCapabilities:%o]', remoteRtpCapabilities);
        remoteRtpCapabilities = utils.clone(remoteRtpCapabilities);
        // Temporal handler to get its capabilities.
        let handler;
        try {
            if (this._loaded) {
                throw new errors_1.InvalidStateError('already loaded');
            }
            // This may throw.
            ortc.validateRtpCapabilities(remoteRtpCapabilities);
            handler = this._handlerFactory();
            const nativeRtpCapabilities = await handler.getNativeRtpCapabilities();
            logger.debug('load() | got native RTP capabilities:%o', nativeRtpCapabilities);
            // This may throw.
            ortc.validateRtpCapabilities(nativeRtpCapabilities);
            // Get extended RTP capabilities.
            this._extendedRtpCapabilities = ortc.getExtendedRtpCapabilities(nativeRtpCapabilities, remoteRtpCapabilities);
            logger.debug('load() | got extended RTP capabilities:%o', this._extendedRtpCapabilities);
            // Check whether we can produce audio/video.
            this._canProduceByKind.audio = ortc.canSend('audio', this._extendedRtpCapabilities);
            this._canProduceByKind.video = ortc.canSend('video', this._extendedRtpCapabilities);
            // Generate our receiving RTP capabilities for receiving media.
            this._recvRtpCapabilities = ortc.getRecvRtpCapabilities(this._extendedRtpCapabilities);
            // This may throw.
            ortc.validateRtpCapabilities(this._recvRtpCapabilities);
            logger.debug('load() | got receiving RTP capabilities:%o', this._recvRtpCapabilities);
            // Generate our SCTP capabilities.
            this._sctpCapabilities = await handler.getNativeSctpCapabilities();
            logger.debug('load() | got native SCTP capabilities:%o', this._sctpCapabilities);
            // This may throw.
            ortc.validateSctpCapabilities(this._sctpCapabilities);
            logger.debug('load() succeeded');
            this._loaded = true;
            handler.close();
            this.resolveReady();
        }
        catch (error) {
            if (handler) {
                handler.close();
            }
            throw error;
        }
    }
    canProduce(kind) {
        if (!this._loaded) {
            throw new errors_1.InvalidStateError('not loaded');
        }
        else if (kind !== 'audio' && kind !== 'video') {
            throw new TypeError(`invalid kind "${kind}"`);
        }
        return this._canProduceByKind[kind];
    }
    createSendTransport({ iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, } = {}) {
        logger.debug('createSendTransport()');
        return this.createTransport({
            direction: 'send',
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
            iceServers,
            iceTransportPolicy,
            additionalSettings,
            appData,
        });
    }
    createRecvTransport({ iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, } = {}) {
        logger.debug('createRecvTransport()');
        return this.createTransport({
            direction: 'recv',
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
            iceServers,
            iceTransportPolicy,
            additionalSettings,
            appData,
        });
    }
    createTransport({ direction, iceParameters, iceCandidates, dtlsParameters, sctpParameters, iceServers, iceTransportPolicy, additionalSettings, appData, }) {
        if (!this._loaded) {
            throw new errors_1.InvalidStateError('not loaded');
        }
        else if (iceParameters && typeof iceParameters !== 'object') {
            throw new TypeError('missing iceParameters');
        }
        else if (iceCandidates && !Array.isArray(iceCandidates)) {
            throw new TypeError('missing iceCandidates');
        }
        else if (dtlsParameters && typeof dtlsParameters !== 'object') {
            throw new TypeError('missing dtlsParameters');
        }
        else if (sctpParameters && typeof sctpParameters !== 'object') {
            throw new TypeError('wrong sctpParameters');
        }
        else if (appData && typeof appData !== 'object') {
            throw new TypeError('if given, appData must be an object');
        }
        // Create a new Transport.
        const transport = new Transport_1.Transport({
            direction,
            iceParameters,
            iceCandidates,
            dtlsParameters,
            sctpParameters,
            iceServers,
            iceTransportPolicy,
            additionalSettings,
            appData,
            handlerFactory: this._handlerFactory,
            extendedRtpCapabilities: this._extendedRtpCapabilities,
            canProduceByKind: this._canProduceByKind,
        });
        // Emit observer event.
        this._observer.safeEmit('newtransport', transport);
        return transport;
    }
}
exports.Device = Device;
