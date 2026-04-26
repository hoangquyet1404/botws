function normalizeTracks(result) {
    const tracks = Array.isArray(result)
        ? result
        : (Array.isArray(result?.tracks) ? result.tracks : []);

    return tracks.map((track) => ({
        ...track,
        id: track.id || track.audio_cluster_id || '',
        audio_cluster_id: track.audio_cluster_id || track.id || '',
        title: track.title || '',
        artist: track.artist || track.subtitle || '',
        duration_ms: Number(track.duration_ms || track.durationMs || 0),
        url: track.url || track.audio_url || track.audioUrl || '',
        audio_url: track.audio_url || track.url || track.audioUrl || '',
        cover_artwork: track.cover_artwork || track.cover || '',
        cover_artwork_large: track.cover_artwork_large || track.cover_artwork || track.cover || ''
    }));
}

function resolveLocalMusicFb2(api) {
    if (typeof api.localApi?.musicFb2 === 'function') {
        return api.localApi.musicFb2.bind(api.localApi);
    }
    if (typeof api.localApi?.message?.musicFb2 === 'function') {
        return api.localApi.message.musicFb2.bind(api.localApi.message);
    }
    return null;
}

module.exports = (api) => async (keyword, callback) => {
    const searchText = String(keyword || '').trim();

    try {
        const localMusicFb2 = resolveLocalMusicFb2(api);
        const result = localMusicFb2
            ? await localMusicFb2(searchText)
            : await api.call('musicFb2', searchText);
        const tracks = normalizeTracks(result);
        if (callback) callback(null, tracks);
        return tracks;
    } catch (e) {
        if (callback) callback(e);
        throw e;
    }
};
