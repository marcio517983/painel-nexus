/** Maximum bidirectional speaking time once the resident answers. Ringing stays at 30 s. */
export const INTERCOM_TALK_MAX_SECONDS=90;
export function talkExpiry(answeredAt){return answeredAt+INTERCOM_TALK_MAX_SECONDS;}
