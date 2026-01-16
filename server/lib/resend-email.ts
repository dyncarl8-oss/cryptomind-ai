import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const notificationEmail = process.env.NOTIFICATION_EMAIL;
const fromEmail = process.env.RESEND_FROM_EMAIL;

if (!resendApiKey) {
  console.warn('[Resend] RESEND_API_KEY not configured - email notifications disabled');
}

if (!notificationEmail) {
  console.warn('[Resend] NOTIFICATION_EMAIL not configured - email notifications disabled');
}

if (!fromEmail) {
  console.warn('[Resend] RESEND_FROM_EMAIL not configured - email notifications disabled');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface UnlimitedAccessClickedData {
  userId: string;
  username: string;
  userEmail?: string;
  timestamp: string;
}

interface WithdrawalRequestData {
  withdrawalId: string;
  adminUserId: string;
  adminUsername: string;
  adminName: string;
  amount: number;
  timestamp: string;
}

export async function sendWithdrawalRequestNotification(data: WithdrawalRequestData): Promise<boolean> {
  if (!resend || !notificationEmail || !fromEmail) {
    console.warn('[Resend] Withdrawal notification skipped - service not fully configured');
    return false;
  }

  try {
    console.log('[Resend] Sending withdrawal request notification...');
    
    const amountUSD = (data.amount / 100).toFixed(2);
    
    const { data: emailData, error } = await resend.emails.send({
      from: fromEmail,
      to: notificationEmail,
      subject: '💰 New Withdrawal Request - CryptoMind AI Admin',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
              .info-row { display: flex; margin: 10px 0; }
              .info-label { font-weight: bold; width: 160px; color: #10b981; }
              .info-value { color: #333; }
              .amount-highlight { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
              .amount-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
              .action-required { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💰 New Withdrawal Request</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">An admin has requested a withdrawal</p>
              </div>
              <div class="content">
                <div class="amount-highlight">
                  <div style="font-size: 14px; opacity: 0.9;">Withdrawal Amount</div>
                  <div class="amount-value">$${amountUSD} USD</div>
                </div>

                <div class="action-required">
                  <strong>⚠️ Action Required:</strong> Please process this withdrawal manually and update the status in your system.
                </div>
                
                <div class="info-box">
                  <h3 style="margin-top: 0; color: #10b981;">Request Details</h3>
                  <div class="info-row">
                    <span class="info-label">Withdrawal ID:</span>
                    <span class="info-value">${data.withdrawalId}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Admin Name:</span>
                    <span class="info-value">${data.adminName}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Username:</span>
                    <span class="info-value">@${data.adminUsername}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Admin User ID:</span>
                    <span class="info-value">${data.adminUserId}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Request Time:</span>
                    <span class="info-value">${new Date(data.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  This withdrawal request has been saved with a "pending" status. After processing the payment, please update the status in your admin dashboard or database.
                </p>
              </div>
              
              <div class="footer">
                <p>CryptoMind AI - AI-Powered Crypto Predictions</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Resend] Failed to send withdrawal notification:', error);
      return false;
    }

    console.log('[Resend] Withdrawal notification sent successfully:', emailData?.id);
    return true;
  } catch (error) {
    console.error('[Resend] Error sending withdrawal notification:', error);
    return false;
  }
}

export async function sendUnlimitedAccessClickedNotification(data: UnlimitedAccessClickedData): Promise<boolean> {
  if (!resend || !notificationEmail || !fromEmail) {
    console.warn('[Resend] Email notification skipped - service not fully configured');
    return false;
  }

  try {
    console.log('[Resend] Sending unlimited access clicked notification...');
    
    const { data: emailData, error } = await resend.emails.send({
      from: fromEmail,
      to: notificationEmail,
      subject: '🎯 New User Clicked "Get Unlimited Access" - CryptoMind AI',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .info-row { display: flex; margin: 10px 0; }
              .info-label { font-weight: bold; width: 140px; color: #667eea; }
              .info-value { color: #333; }
              .cta { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 Potential Customer Alert!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Someone clicked "Get Unlimited Access"</p>
              </div>
              <div class="content">
                <p>A user just expressed interest in upgrading to unlimited access on CryptoMind AI!</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0; color: #667eea;">User Details</h3>
                  <div class="info-row">
                    <span class="info-label">User ID:</span>
                    <span class="info-value">${data.userId}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Username:</span>
                    <span class="info-value">${data.username}</span>
                  </div>
                  ${data.userEmail ? `
                  <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${data.userEmail}</span>
                  </div>
                  ` : ''}
                  <div class="info-row">
                    <span class="info-label">Timestamp:</span>
                    <span class="info-value">${new Date(data.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  This notification is sent automatically when users click the "Get Unlimited Access" button in your CryptoMind AI app.
                </p>
              </div>
              
              <div class="footer">
                <p>CryptoMind AI - AI-Powered Crypto Predictions</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Resend] Failed to send email notification:', error);
      return false;
    }

    console.log('[Resend] Email notification sent successfully:', emailData?.id);
    return true;
  } catch (error) {
    console.error('[Resend] Error sending email notification:', error);
    return false;
  }
}
