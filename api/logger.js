const winston = require('winston');
const fs = require('fs');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
	filename: '%DATE%.log',
	dirname: 'logs',
	datePattern: 'YYYY-MM-DD',
	zippedArchive: false,
	maxSize: '1m',
	maxFiles: '30d',
	utc: false
});

const logFormat = winston.format.combine(
	winston.format.timestamp({
		format: 'YYYY-MM-DD HH:mm:ss'
	}),
	winston.format.printf(
		info =>
			`log: { timestamp: ${info.timestamp}, message: ${info.message}, type: ${info.level}}`
	)
);

const logger = winston.createLogger({
	format: logFormat,
	transports: [transport]
});
module.exports = logger;
