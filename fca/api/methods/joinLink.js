/**
 * joinLink (Custom wrapper for object export)
 * Exposes .view and .join
 */
module.exports = (api) => {
    return {
        view: async (linkOrHash, options) => {
            if (!linkOrHash) throw new Error("joinLink.view: linkOrHash is required");
            return await api.call('joinLink.view', linkOrHash, options);
        },
        join: async (linkOrHash, options) => {
            if (!linkOrHash) throw new Error("joinLink.join: linkOrHash is required");
            return await api.call('joinLink.join', linkOrHash, options);
        }
    };
};
