const sendEmail = require("../utils/email"); // Adjust path as needed
const TutorProfile = require("../models/Tutor");
const Class = require("../models/Class");
const ClassSession = require("../models/ClassSession");
const Activity = require("../models/Activity");

// Function to send reminder email for upcoming sessions
const sendUpcomingSessionReminder = async (tutorEmail, tutorName, sessionDetails) => {
  const subject = "Reminder: Upcoming Tutoring Session Tomorrow";
  const text = `Hello ${tutorName}, you have a tutoring session scheduled for tomorrow: ${sessionDetails.subject} on ${sessionDetails.date} from ${sessionDetails.startTime} to ${sessionDetails.endTime} in ${sessionDetails.room || 'Not specified'}.`;
  
  const logoUrl = "https://i.vgy.me/H3p13y.png"; 
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head> 
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Session Reminder</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f5f5f5">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 30px 0 20px; background-color: #f0f9f0; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                  <img src="${logoUrl}" alt="Ascentia Academy Logo" width="150" style="display: block;">
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 20px 40px 0;">
                  <h2 style="color: #2e7d32; margin-bottom: 20px; border-bottom: 2px solid #a5d6a7; padding-bottom: 10px;">Dear ${tutorName},</h2>
                </td>
              </tr>
              
              <!-- Main Content Box -->
              <tr>
                <td style="padding: 0 40px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background-color: #e8f5e9; border-left: 4px solid #2e7d32; padding: 20px; border-radius: 4px;">
                        <h3 style="color: #2e7d32; margin-top: 0;">Upcoming Session Reminder</h3>
                        <p style="margin-bottom: 15px; color: #1b5e20;">This is a friendly reminder that you have a tutoring session scheduled for tomorrow:</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Session Details -->
              <tr>
                <td style="padding: 25px 40px 0;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #c8e6c9; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td style="background-color: #2e7d32; padding: 12px 20px; color: white; font-weight: bold;">
                        Session Details
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="30%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Subject:</td>
                            <td width="70%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9;">${sessionDetails.subject}</td>
                          </tr>
                          <tr>
                            <td width="30%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Date:</td>
                            <td width="70%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9;">${sessionDetails.date}</td>
                          </tr>
                          <tr>
                            <td width="30%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Time:</td>
                            <td width="70%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9;">${sessionDetails.startTime} - ${sessionDetails.endTime}</td>
                          </tr>
                          <tr>
                            <td width="30%" style="padding: 14px 20px; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Room:</td>
                            <td width="70%" style="padding: 14px 20px;">${sessionDetails.room || 'Not specified'}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Instructions and CTA -->
              <tr>
                <td style="padding: 30px 40px; text-align: center;">
                  <p style="margin-bottom: 15px; text-align: left;">Please ensure you're prepared and on time for the session. Your students are counting on you!</p>
                  <a href="http://ascentiabucket.s3-website.eu-north-1.amazonaws.com/" style="display: inline-block; background-color: #4caf50; color: white; text-decoration: none; padding: 15px 35px; border-radius: 4px; font-weight: bold; margin-top: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Login to Dashboard</a>
                </td>
              </tr>
              
              <!-- Need Assistance -->
              <tr>
                <td style="padding: 0 40px 25px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f8e9; border-radius: 6px; padding: 15px; border: 1px solid #c8e6c9;">
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 14px;"><strong style="color: #2e7d32;">Need assistance?</strong><br>Contact our support team at <a href="mailto:support@ascentia.com" style="color: #4caf50; text-decoration: none; font-weight: bold;">support@ascentia.com</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #2e7d32; padding: 25px 40px; color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color: white; font-size: 14px;">
                        <p style="margin: 0; font-size: 18px; font-weight: bold;">Ascentia Academy</p>
                        <p style="margin: 10px 0 5px;">Email: <a href="mailto:support@ascentia.com" style="color: #a5d6a7; text-decoration: none;">support@ascentia.com</a></p>
                        <p style="margin: 5px 0;">Phone: 03105725515</p>
                        <p style="margin: 5px 0;">Website: <a href="http://ascentiabucket.s3-website.eu-north-1.amazonaws.com/" style="color: #a5d6a7; text-decoration: none;">ascentia.com</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #757575; margin-top: 20px;">&copy; ${new Date().getFullYear()} Ascentia Academy. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail(tutorEmail, subject, text, html);
    console.log(`Reminder email sent to ${tutorEmail}`);

    // Log activity
    const newActivity = new Activity({
      name: "Session Reminder Email Sent",
      description: `Reminder email sent for session scheduled on ${sessionDetails.date}`,
      tutorId: sessionDetails.tutorId
    });
    await newActivity.save();

    return true;
  } catch (error) {
    console.error(`Error sending reminder email to ${tutorEmail}:`, error);
    return false;
  }
};
// Function to send completion reminder for sessions that occurred today
const sendCompletionReminder = async (tutorEmail, tutorName, sessionDetails) => {
  const subject = "IMPORTANT: Mark Your Session As Completed";
  const text = `Hello ${tutorName}, our records show that you had a tutoring session today (${sessionDetails.subject} on ${sessionDetails.date} from ${sessionDetails.startTime} to ${sessionDetails.endTime}) that has not been marked as completed. Please log in to mark it completed to ensure you receive payment.`;

  const logoUrl = "https://i.vgy.me/H3p13y.png";

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Action Required</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f5f5f5">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 30px 0 20px; background-color: #ffffff; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                    <img src="${logoUrl}" alt="Ascentia Academy Logo" width="80" style="display: block;">
                </td>
              </tr>
              
              <!-- Greeting -->
              <tr>
                <td style="padding: 20px 40px 0;">
                  <h2 style="color: #2e7d32; margin-bottom: 20px; border-bottom: 2px solid #a5d6a7; padding-bottom: 10px;">Dear ${tutorName},</h2>
                </td>
              </tr>
              
              <!-- Main Content Box -->
              <tr>
                <td style="padding: 0 40px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="background-color: #e8f5e9; border-left: 4px solid #2e7d32; padding: 20px; border-radius: 4px;">
                        <h3 style="color: #2e7d32; margin-top: 0;">Action Required</h3>
                        <p style="margin-bottom: 0; color: #1b5e20;">Our records show that you had a tutoring session today that has not been marked as completed.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Session Details -->
              <tr>
                <td style="padding: 25px 40px 0;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #c8e6c9; border-radius: 8px; overflow: hidden;">
                    <tr>
                      <td style="background-color: #2e7d32; padding: 12px 20px; color: white; font-weight: bold;">
                        Session Details
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 0;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="30%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Subject:</td>
                            <td width="70%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9;">${sessionDetails.subject}</td>
                          </tr>
                          <tr>
                            <td width="30%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Date:</td>
                            <td width="70%" style="padding: 14px 20px; border-bottom: 1px solid #c8e6c9;">${sessionDetails.date}</td>
                          </tr>
                          <tr>
                            <td width="30%" style="padding: 14px 20px; background-color: #f1f8e9; font-weight: bold; color: #2e7d32;">Time:</td>
                            <td width="70%" style="padding: 14px 20px;">${sessionDetails.startTime} - ${sessionDetails.endTime}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Pending Steps -->
              <tr>
                <td style="padding: 30px 40px 20px;">
                  <h3 style="color: #2e7d32; margin-top: 0; margin-bottom: 15px; border-bottom: 1px solid #c8e6c9; padding-bottom: 8px;">Pending Steps:</h3>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding: 15px; background-color: #f1f8e9; border-radius: 6px; border-left: 3px solid #2e7d32;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td width="24" valign="top">
                              <span style="display: inline-block; width: 24px; height: 24px; background-color: #4caf50; border-radius: 50%; color: white; text-align: center; line-height: 24px; font-weight: bold; font-size: 16px;">!</span>
                            </td>
                            <td style="padding-left: 15px;">
                              <span style="font-weight: bold; color: #1b5e20; font-size: 16px;">Complete Session Marking</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Warning Message -->
              <tr>
                <td style="padding: 0 40px 20px;">
                  <div style="background-color: #e8f5e9; border-radius: 6px; padding: 15px; border: 1px dashed #4caf50;">
                    <p style="color: #2e7d32; font-weight: bold; margin: 0;">Important: Failure to mark the session as completed may result in delayed payment or non-payment for this session.</p>
                  </div>
                </td>
              </tr>
              
              <!-- Instructions and CTA -->
              <tr>
                <td style="padding: 0 40px 30px; text-align: center;">
                  <a href="http://ascentiabucket.s3-website.eu-north-1.amazonaws.com/" style="display: inline-block; background-color: #4caf50; color: white; text-decoration: none; padding: 15px 35px; border-radius: 4px; font-weight: bold; margin-top: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Mark Session as Completed</a>
                </td>
              </tr>
              
              <!-- Need Assistance -->
              <tr>
                <td style="padding: 0 40px 25px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f8e9; border-radius: 6px; padding: 15px; border: 1px solid #c8e6c9;">
                    <tr>
                      <td>
                        <p style="margin: 0; font-size: 14px;"><strong style="color: #2e7d32;">Need assistance?</strong><br>Contact our support team at <a href="mailto:support@ascentia.com" style="color: #4caf50; text-decoration: none; font-weight: bold;">support@ascentia.com</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #2e7d32; padding: 25px 40px; color: white; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color: white; font-size: 14px;">
                        <p style="margin: 0; font-size: 18px; font-weight: bold;">Ascentia Academy</p>
                        <p style="margin: 10px 0 5px;">Email: <a href="mailto:support@ascentia.com" style="color: #a5d6a7; text-decoration: none;">support@ascentia.com</a></p>
                        <p style="margin: 5px 0;">Phone: 03105725515</p>
                        <p style="margin: 5px 0;">Website: <a href="http://ascentiabucket.s3-website.eu-north-1.amazonaws.com/" style="color: #a5d6a7; text-decoration: none;">ascentia.com</a></p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="font-size: 12px; color: #757575; margin-top: 20px;">&copy; ${new Date().getFullYear()} Ascentia Academy. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await sendEmail(tutorEmail, subject, text, html);
    console.log(`Completion reminder email sent to ${tutorEmail}`);

    // Log activity
    const newActivity = new Activity({
      name: "Session Completion Reminder Email Sent",
      description: `Reminder email sent to mark session on ${sessionDetails.date} as completed`,
      tutorId: sessionDetails.tutorId
    });
    await newActivity.save();

    return true;
  } catch (error) {
    console.error(`Error sending completion reminder email to ${tutorEmail}:`, error);
    return false;
  }
};

// Main function to check and send emails (to be called by the cron job)
const checkAndSendSessionEmails = async () => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Format dates for comparison
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
    const todayDateStr = today.toISOString().split('T')[0];

    const tutors = await TutorProfile.find({}).populate('user');

    for (const tutor of tutors) {
      if (!tutor.user || !tutor.user.email) continue;

      const classes = await Class.find({ tutor: tutor._id });
      const classIds = classes.map(c => c._id);

      const tomorrowSessions = await ClassSession.find({
        class: { $in: classIds },
        date: { $gte: new Date(tomorrowDateStr), $lt: new Date(new Date(tomorrowDateStr).getTime() + 24 * 60 * 60 * 1000) },
        status: 'scheduled'
      }).populate({
        path: 'class',
        select: 'subject'
      }).populate('room');

      // Send reminder emails for tomorrow's sessions
      for (const session of tomorrowSessions) {
        const sessionDetails = {
          subject: session.class.subject,
          date: new Date(session.date).toLocaleDateString(),
          startTime: session.startTime,
          endTime: session.endTime,
          room: session.room?.name || 'Not specified',
          tutorId: tutor.user._id
        };

        await sendUpcomingSessionReminder(
          tutor.user.email,
          tutor.user.firstName || 'Tutor',
          sessionDetails
        );
      }

      // Check for today's sessions that aren't marked completed
      const todaySessions = await ClassSession.find({
        class: { $in: classIds },
        date: { $gte: new Date(todayDateStr), $lt: new Date(new Date(todayDateStr).getTime() + 24 * 60 * 60 * 1000) },
        status: { $nin: ['completed', 'pending'] }
      }).populate({
        path: 'class',
        select: 'subject'
      });

      // Send completion reminder emails for today's sessions
      for (const session of todaySessions) {
        // Only send reminder if the session's end time has passed
        const [endHour, endMinute] = session.endTime.split(':').map(Number);
        const sessionEndTime = new Date(today);
        sessionEndTime.setHours(endHour, endMinute, 0, 0);

        if (today > sessionEndTime) {
          const sessionDetails = {
            subject: session.class.subject,
            date: new Date(session.date).toLocaleDateString(),
            startTime: session.startTime,
            endTime: session.endTime,
            tutorId: tutor.user._id
          };

          await sendCompletionReminder(
            tutor.user.email,
            tutor.user.firstName || 'Tutor',
            sessionDetails
          );
        }
      }
    }

    console.log('Session email check completed successfully');
    return true;
  } catch (error) {
    console.error('Error in checkAndSendSessionEmails:', error);
    return false;
  }
};

const manuallyTriggerSessionEmails = async (req, res) => {
  try {
    const result = await checkAndSendSessionEmails();
    if (result) {
      res.status(200).json({
        status: 'success',
        message: 'Session emails triggered successfully'
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Error triggering session emails'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

module.exports = {
  checkAndSendSessionEmails,
  manuallyTriggerSessionEmails
};