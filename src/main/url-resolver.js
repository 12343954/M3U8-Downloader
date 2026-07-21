const fs = require('fs');
const path = require('path');

function getParentUri(uri) {
    return uri.replace(/([^\/]*\?.*$)|([^\/]*$)/g, '');
}

function joinUrl(base, relative) {
    return base + (base.endsWith('/') || relative.startsWith('/') ? '' : '/') + relative;
}

function getOrigin(uri) {
    const match = uri.match(/^https?:\/\/[^/]*/);
    return match && match.length >= 1 ? match[0] : '';
}

function resolveHttpUri(baseUrl, relativeUri) {
    if (/^http.*/.test(relativeUri)) return relativeUri;
    if (/^\/.*/.test(relativeUri)) {
        const origin = getOrigin(baseUrl);
        return origin ? origin + relativeUri : getParentUri(baseUrl) + relativeUri;
    }
    return joinUrl(getParentUri(baseUrl), relativeUri);
}

function resolveLocalFileUri(baseUrl, relativeUri) {
    const fileDir = baseUrl.replace('file:///', '').replace(/[^\\/]{1,}$/, '');
    let localPath = path.join(fileDir, relativeUri);
    if (!fs.existsSync(localPath)) {
        localPath = path.join(fileDir, relativeUri.split('?')[0]);
    }
    return fs.existsSync(localPath) ? `file:///${localPath}` : '';
}

function resolveMediaUri(baseUrl, urlPrefix, mediaUri) {
    if (/^http.*/.test(mediaUri)) return mediaUri;
    if (/^http/.test(baseUrl)) return resolveHttpUri(baseUrl, mediaUri);
    if (/^file:\/\/\//.test(baseUrl) && urlPrefix) return joinUrl(urlPrefix, mediaUri);
    if (/^file:\/\/\//.test(baseUrl)) return resolveLocalFileUri(baseUrl, mediaUri);
    return mediaUri;
}

function resolveKeyUri(baseUrl, urlPrefix, keyUri) {
    if (/^http.*/.test(keyUri)) return keyUri;
    if (/^http/.test(baseUrl)) return resolveHttpUri(baseUrl, keyUri);
    if (/^file:\/\/\//.test(baseUrl) && urlPrefix) return joinUrl(urlPrefix, keyUri);
    if (/^file:\/\/\//.test(baseUrl)) return resolveLocalFileUri(baseUrl, keyUri);
    return keyUri;
}

module.exports = {
    getParentUri,
    resolveHttpUri,
    resolveMediaUri,
    resolveKeyUri
};
