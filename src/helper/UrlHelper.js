class UrlHelper {
    /**
     * @public
     * @param name string
     * @returns {string}
     */
    getUrlParameter(name) {
        return this.getUrlParams()[name];
    };

    /**
     * @public
     * @returns {object}
     */
    getUrlParams() {
        let params = {};

        decodeURIComponent(window.location).replace(
            /[?&]+([^=&]+)=([^&#]*)/gi,
            function(m, key, value) {
                params[key] = value;
            }
        );

        return params;
    }
}

export default UrlHelper;
