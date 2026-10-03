// Keep the whole multipart envelope below the hosted function's 4.5 MB limit.
export const communityImageMaxMegabytes = 4;
export const communityImageMaxBytes = communityImageMaxMegabytes * 1024 * 1024;
export const communityUploadMaxBytes = communityImageMaxBytes + 64 * 1024;
