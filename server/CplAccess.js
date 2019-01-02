const _      = require('lodash');
const http   = require('http');
const Moment = require('moment');

const CACHE = new Map();

module.exports = {
	getAllPointsLists : async function() {
		const cacheKey = getCacheKey('all-lists');

		if (!CACHE.has(cacheKey)) {
			let data = await getContent('/ViewPoints.asp?format=json');
			data     = processPointsLists(data);

			// only cache if request succeeded
			CACHE.set(cacheKey, data);
		}

		return CACHE.get(cacheKey);
	},

	getPointsListData : async function(id) {
		const cacheKey = getCacheKey(id);

		if (!CACHE.listData.has(cacheKey)) {
			let data = await getContent(`/ViewPointsList.asp?id=${id}&format=json`);
			data     = processPointsListData(data);

			// only cache if request succeeded
			CACHE.set(cacheKey, data);
		}

		return CACHE.get(cacheKey);
	},
};

function processPointsLists(pojo) {
	return _(pojo.pointsLists)
		.filter({ listType : 'Seeding' })
		.groupBy('publicationDate')
		.map(similarLists => ({
			name            : _(similarLists).map('name').uniq().valueOf().join(' / '),
			startDate       : reformatDate(similarLists[0].startDate),
			endDate         : reformatDate(similarLists[0].endDate),
			publicationDate : reformatDate(similarLists[0].publicationDate),
			lists           : _.pick(similarLists, (value, key) => !_.includes([ 'startDate', 'endDate', 'publicationDate' ], key)),
		}))
		.valueOf();
}

function processPointsListData(pojo) {
	return _.filter(pojo.skiers, { country : 'CAN', division : 'ON' });
}

function reformatDate(str) {
	str = str.replace(/&nbsp;/gi, ' '); // MUSTDO: fix API
	return new Moment(str, 'MMM D, YYYY').format('YYYY-MM-DD');
}

/**
 * Cache data by day, assuming that the content on CCC will not be frequently updated.
 * This method returns the key used to cache content.
 * @param  {String|Number} param
 * @return {String}
 */
function getCacheKey(param) {
	const dateStr = new Moment().format('YYYY-MM-DD');
	return `${param}-${dateStr}`;
}

/**
 * Issues a GET request to a path and returns the JSON content of the response
 * @param  {String} path
 * @return {Object}
 */
function getContent(path) {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				method   : 'GET',
				hostname : 'apps.cccski.com',
				path,
			},
			function(res) {
				let body = Buffer.from([]);
				res.on('data', function(chunk) {
					body = Buffer.concat([ body, chunk ]);
				});
				res.on('end', function() {
					// parse response, assuming JSON format
					try {
						body = JSON.parse(body.toString());
					}
					catch (e) {} // eslint-disable-line no-empty

					if (res.statusCode >= 300) {
						return reject({ status : res.statusCode, message : res.statusMessage, data : body });
					}

					resolve(body);
				});
			}
		);

		req.on('error', function(e) {
			if (e) {
				console.log('REQ ERROR');
				reject({ status : e.statusCode || undefined, message : e.message || e, data : e.data ? e.data.toString() : undefined });
			}
			else {
				reject();
			}
		});

		req.end();
	});
}




//getContent('ViewPoints.asp?format=json').catch(e => console.log('ERR', e))

