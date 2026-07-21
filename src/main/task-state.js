function createTaskState({ taskStatus, i18n, percentFormat }) {
    const resumableStatuses = new Set([
        taskStatus.initializing,
        taskStatus.checkM3U8url,
        taskStatus.downloading,
        taskStatus.downloadMerging,
        taskStatus.downloadLiveStreaming,
        taskStatus.startMerge,
        taskStatus.merging
    ]);

    function canRestoreAsPaused(status) {
        return resumableStatuses.has(status);
    }

    function pauseTask(video) {
        video.status = taskStatus.pause;
        video.statusText = i18n.t('task.pause', {
            count_downloaded: video.segment_downloaded,
            count_seg: video.segment_total,
            percent: percentFormat(video.segment_downloaded, video.segment_total)
        });
        return video;
    }

    function resumeTask(video) {
        if (video.segment_total == video.segment_downloaded) {
            video.status = taskStatus.startMerge;
            video.statusText = i18n.t('taskStatus.startMerge');
        } else {
            video.status = taskStatus.downloading;
            video.statusText = i18n.t('taskStatus.downloading', {
                count_downloaded: video.segment_downloaded,
                count_seg: video.segment_total,
                percent: percentFormat(video.segment_downloaded, video.segment_total)
            });
        }
        return video;
    }

    function failTask(video, status, text) {
        video.success = false;
        video.status = status;
        video.statusText = text;
        return video;
    }

    return {
        canRestoreAsPaused,
        pauseTask,
        resumeTask,
        failTask
    };
}

module.exports = {
    createTaskState
};
