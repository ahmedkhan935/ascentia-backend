const cron = require('node-cron');
const { checkAndSendSessionEmails } = require('./sessionEmailService'); // Adjust path if needed

// Logging function
const logMessage = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CRON: ${message}`);
};

// Schedule email reminders to run every day at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  logMessage('Running daily session email check for tomorrow\'s sessions...');
  try {
    await checkAndSendSessionEmails();
    logMessage('Daily session email check completed successfully');
  } catch (error) {
    logMessage(`Error in daily email check: ${error.message}`); 
    console.error(error);
  }
});

// Schedule additional check in the evening (e.g., 8:00 PM) 
// to remind tutors who haven't marked completed sessions from the day
cron.schedule('0 20 * * *', async () => {
  logMessage('Running evening session completion reminder check...');
  try {
    await checkAndSendSessionEmails();
    logMessage('Evening session reminder check completed successfully');
  } catch (error) {
    logMessage(`Error in evening email check: ${error.message}`);
    console.error(error);
  }
});

// Optional: Run immediately on startup to test
// Remove this in production if you don't want an immediate run
// setTimeout(async () => {
//   logMessage('Running initial session email check on startup...');
//   try {
//     await checkAndSendSessionEmails();
//     logMessage('Initial session email check completed successfully');
//   } catch (error) {
//     logMessage(`Error in initial email check: ${error.message}`);
//     console.error(error);
//   }
// }, 10000); // Wait 10 seconds after server start before running

// logMessage('Cron jobs scheduled successfully');

module.exports = {
  initialized: true
};