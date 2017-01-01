(function () {
    var href = window.location.href;
    if ((href.lastIndexOf('/') + 1) == href.length)
        return;
    window.location.href = href + '/';
})();