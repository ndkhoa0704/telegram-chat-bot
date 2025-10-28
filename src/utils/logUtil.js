const winston = require('winston');
const path = require('node:path');
const fs = require('node:fs');

const { format, transports } = winston;

// Ensure logs directory exists
const logDir = path.join(path.dirname(__dirname), '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Get current date for log filename
const getFormattedDate = () => {
    const now = new Date();
    // Convert to GMT+7 timezone
    const gmt7Time = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return `${gmt7Time.getUTCFullYear()}-${String(gmt7Time.getUTCMonth() + 1).padStart(2, '0')}-${String(gmt7Time.getUTCDate()).padStart(2, '0')}`;
};

// Define the format for logs
const logFormat = format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ level, message, timestamp, stack }) => {
        if (stack) {
            return `${timestamp} ${level}: ${message}\n${stack}`;
        }
        return `${timestamp} ${level}: ${message}`;
    })
);

// Create Winston logger with console and file transports
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Console transport
        new transports.Console({
            format: format.combine(
                format.colorize(),
                logFormat
            )
        }),

        // File transport with date-based filename
        new transports.File({
            filename: path.join(logDir, `application-${getFormattedDate()}.log`),
            format: logFormat,
            maxsize: 104857600, // 100MB
            maxFiles: 7,
            tailable: true
        })
    ]
});

// Add a function to update the file transport with new date if needed
const updateFileTransport = () => {
    const currentDate = getFormattedDate();
    const fileTransport = logger.transports.find(t => t instanceof transports.File);

    if (fileTransport) {
        const expectedFilename = path.join(logDir, `application-${currentDate}.log`);
        if (fileTransport.filename !== expectedFilename) {
            // Remove old transport
            logger.remove(fileTransport);

            // Add new transport with updated filename
            logger.add(new transports.File({
                filename: expectedFilename,
                format: logFormat,
                maxsize: 104857600, // 100MB
                maxFiles: 7,
                tailable: true
            }));
        }
    }
};

// Function to delete log files older than 7 days
const deleteOldLogs = () => {
    fs.readdir(logDir, (err, files) => {
        if (err) {
            logger.error(`Error reading log directory: ${err.stack}`);
            return;
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        files.forEach(file => {
            const filePath = path.join(logDir, file);
            const match = file.match(/^application-(\d{4}-\d{2}-\d{2})\.log$/);

            if (match) {
                const logDate = new Date(match[1]);
                if (logDate < sevenDaysAgo) {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) {
                            logger.error(`Failed to delete old log file ${filePath}: ${unlinkErr.stack}`);
                        } else {
                            logger.info(`Deleted old log file: ${filePath}`);
                        }
                    });
                }
            }
        });
    });
};

// Set up daily check for date change (midnight rollover)
setInterval(updateFileTransport, 60 * 60 * 1000); // Check every hour

// Clean up old logs on startup and then daily
deleteOldLogs();
setInterval(deleteOldLogs, 24 * 60 * 60 * 1000); // Check every 24 hours

// Add stream for Morgan if needed for HTTP request logging
logger.stream = {
    write: (message) => logger.info(message.trim())
};

module.exports = logger;