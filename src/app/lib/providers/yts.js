(function (App) {
    'use strict';

    var Q = require('q');
    var request = require('request');
    var inherits = require('util').inherits;
    var sanitizer = require('sanitizer');

    function YTS() {
        if (!(this instanceof YTS)) {
            return new YTS();
        }

        App.Providers.Generic.call(this);
    }
    inherits(YTS, App.Providers.Generic);

    YTS.prototype.extractIds = function (items) {
        return _.pluck(items.results, 'imdb_id');
    };

    var format = function (data) {
        var results = _.chain(data.movies)
            .filter(function (movie) {
                // Filter any 3D only movies
                return _.any(movie.torrents, function (torrent) {
                    return torrent.quality !== '3D';
                });
            }).map(function (movie) {
                console.log(movie);
                var movie_data = {
                    type: 'movie',
                    imdb_id: sanitizer.sanitize(movie.imdb_code),
                    title: sanitizer.sanitize(movie.title_english),
                    year: sanitizer.sanitize(movie.year),
                    genre: _.map(movie.genres, function (val, key) {
                        return sanitizer.sanitize(val);
                    }),
                    rating: sanitizer.sanitize(movie.rating),
                    runtime: sanitizer.sanitize(movie.runtime),
                    image: sanitizer.sanitize(movie.medium_cover_image),
                    cover: sanitizer.sanitize(movie.large_cover_image),
                    backdrop: sanitizer.sanitize(movie.background_image_original),
                    synopsis: sanitizer.sanitize(movie.description_full),
                    trailer: 'https://www.youtube.com/watch?v=' + sanitizer.sanitize(movie.yt_trailer_code) || false,
                    certification: sanitizer.sanitize(movie.mpa_rating),
                    torrents: _.reduce(movie.torrents, function (torrents, torrent) {
                        if (torrent.quality !== '3D') {
                            torrents[torrent.quality] = {
                                url: sanitizer.sanitize(torrent.url),
                                magnet: 'magnet:?xt=urn:btih:' + torrent.hash + '&tr=udp://open.demonii.com:1337&tr=udp://tracker.coppersurfer.tk:6969',
                                size: sanitizer.sanitize(torrent.size_bytes),
                                filesize: sanitizer.sanitize(torrent.size),
                                seed: sanitizer.sanitize(torrent.seeds),
                                peer: sanitizer.sanitize(torrent.peers)
                            };
                        }
                        return torrents;
                    }, {})
                };
                console.log(movie_data);
                return movie_data;
            }).value();

        return {
            results: results,
            hasMore: data.movie_count > data.page_number * data.limit
        };
    };

    YTS.prototype.fetch = function (filters) {
        var params = {
            sort_by: 'seeds',
            limit: 50,
            with_rt_ratings: true
        };

        if (filters.page) {
            params.page = filters.page;
        }

        if (filters.keywords) {
            params.query_term = filters.keywords;
        }

        if (filters.genre) {
            params.genre = filters.genre;
        }

        if (filters.order === 1) {
            params.order_by = 'asc';
        }

        if (filters.sorter && filters.sorter !== 'popularity') {
            switch (filters.sorter) {
            case 'last added':
                params.sort_by = 'date_added';
                break;
            case 'trending':
                params.sort_by = 'trending_score';
                break;
            default:
                params.sort_by = filters.sorter;
            }
        }

        if (Settings.movies_quality !== 'all') {
            params.quality = Settings.movies_quality;
        }

        if (Settings.translateSynopsis) {
            params.lang = Settings.language;
        }

        var defer = Q.defer();

        request({
            uri: 'http://cloudflare.com/api/v2/list_movies_pct.json',
            qs: params,
            headers: {
                'Host': 'xor.image.yt',
                'User-Agent': 'Mozilla/5.0 (Linux) AppleWebkit/534.30 (KHTML, like Gecko) PT/3.8.0'
            },
            strictSSL: false,
            json: true,
            timeout: 10000
        }, function (err, res, data) {
            if (err || res.statusCode >= 400) {
                return defer.reject(err || 'Status Code is above 400');
            } else if (!data || data.status === 'error') {
                err = data ? data.status_message : 'No data returned';
                return defer.reject(err);
            } else {
                return defer.resolve(format(data.data));
            }
        });

        return defer.promise;
    };

    YTS.prototype.random = function () {
        var defer = Q.defer();

        request({
            uri: 'http://cloudflare.com/api/v2/get_random_movie.json?' + Math.round((new Date()).valueOf() / 1000),
            headers: {
                'Host': 'xor.image.yt',
                'User-Agent': 'Mozilla/5.0 (Linux) AppleWebkit/534.30 (KHTML, like Gecko) PT/3.8.0'
            },
            strictSSL: false,
            json: true,
            timeout: 10000
        }, function (err, res, data) {
            if (err || res.statusCode >= 400) {
                return defer.reject(err || 'Status Code is above 400');
            } else if (!data || data.status === 'error') {
                err = data ? data.status_message : 'No data returned';
                return defer.reject(err);
            } else {
                return defer.resolve(data.data);
            }
        });
        return defer.promise;
    };

    YTS.prototype.detail = function (torrent_id, old_data) {
        return Q(old_data);
    };

    App.Providers.Yts = YTS;

})(window.App);
