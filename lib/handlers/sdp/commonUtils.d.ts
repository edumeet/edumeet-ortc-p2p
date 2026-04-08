import * as sdpTransform from 'sdp-transform';
import { DtlsParameters, IceParameters } from '../../Transport';
import { RtpCapabilities, RtpParameters } from '../../RtpParameters';
/**
 * This function must be called with an SDP with 1 m=audio and 1 m=video
 * sections.
 */
export declare function extractRtpCapabilities({ sdpObject }: {
    sdpObject: sdpTransform.SessionDescription;
}): RtpCapabilities;
export declare function extractDtlsParameters({ sdpObject }: {
    sdpObject: sdpTransform.SessionDescription;
}): DtlsParameters;
export declare function extractIceParameters({ sdpObject }: {
    sdpObject: sdpTransform.SessionDescription;
}): IceParameters;
export declare function getCname({ offerMediaObject }: {
    offerMediaObject: sdpTransform.MediaDescription;
}): string;
/**
 * Apply codec parameters in the given SDP m= section answer based on the
 * given RTP parameters of an offer.
 */
export declare function applyCodecParameters({ offerRtpParameters, answerMediaObject }: {
    offerRtpParameters: RtpParameters;
    answerMediaObject: sdpTransform.MediaDescription;
}): void;
//# sourceMappingURL=commonUtils.d.ts.map