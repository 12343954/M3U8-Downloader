function createTaskRuntime() {
    let states = {};

    function has(id) {
        return Object.prototype.hasOwnProperty.call(states, id);
    }

    function isActive(id) {
        return !!states[id];
    }

    function start(id) {
        states[id] = true;
    }

    function stop(id) {
        states[id] = false;
    }

    function remove(id) {
        stop(id);
        delete states[id];
    }

    function resetFromTasks(tasks, active = false) {
        states = (tasks || []).reduce((obj, item) => {
            obj[item.id] = active;
            return obj;
        }, {});
    }

    function snapshot() {
        return { ...states };
    }

    return {
        has,
        isActive,
        start,
        stop,
        remove,
        resetFromTasks,
        snapshot
    };
}

module.exports = {
    createTaskRuntime
};
