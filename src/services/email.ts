/**
 * Email Service for eSIM Delivery
 * Uses Nodemailer with SMTP
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import QRCode from 'qrcode';
import type { PrismaClient } from '@prisma/client';

export interface EsimPayload {
  lpa: string;
  activationCode: string;
  iccid: string;
}

export interface DeliveryEmailData {
  to: string;
  orderNumber: string;
  productName?: string;
  esimPayload: EsimPayload;
  region?: string;
  dataAmount?: string;
  validity?: string;
}

/**
 * Get or create Nodemailer transporter
 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[EmailService] SMTP credentials not configured - emails will be logged only');
    console.warn('[EmailService] Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: {
      user,
      pass,
    },
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000,
  });
}

/**
 * Parse SM-DP+ address from LPA string
 * LPA format: LPA:1$<smdp_address>$<activation_code>
 */
function parseSmdpFromLpa(lpa: string): string {
  const parts = lpa.split('$');
  if (parts.length >= 2) {
    return parts[1];
  }
  return 'smdp.io';
}

/**
 * Generate QR code as buffer for email attachment
 */
export async function generateQRCodeBuffer(lpaString: string): Promise<Buffer> {
  try {
    const buffer = await QRCode.toBuffer(lpaString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return buffer;
  } catch (error) {
    console.error('[EmailService] QR code generation failed:', error);
    throw error;
  }
}

/**
 * Build HTML email content for eSIM delivery
 */
function buildEmailHtml(data: DeliveryEmailData): string {
  const { orderNumber, productName, esimPayload, region, dataAmount, validity } = data;

  const smdpAddress = parseSmdpFromLpa(esimPayload.lpa);
  const productTitle = productName || 'Your eSIM';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your eSIM is Ready!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .qr-section { text-align: center; background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 20px 0; }
    .qr-code { max-width: 250px; margin: 20px auto; }
    .qr-code img { width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .details-box { background: #e8f4f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .details-box h3 { margin-top: 0; color: #2c5282; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #d1e3ed; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #4a5568; }
    .detail-value { color: #2d3748; font-family: monospace; word-break: break-all; }
    .instructions { margin: 30px 0; }
    .instructions h2 { color: #2c5282; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    .step { display: flex; margin: 15px 0; align-items: flex-start; }
    .step-number { background: #667eea; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
    .step-content { flex: 1; }
    .platform { background: #f7fafc; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
    .platform h4 { margin: 0 0 10px 0; color: #4a5568; }
    .manual-codes { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107; }
    .manual-codes h3 { margin-top: 0; color: #856404; }
    .code-box { background: white; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 14px; word-break: break-all; margin: 10px 0; border: 1px solid #e2e8f0; }
    .footer { background: #2d3748; color: #a0aec0; padding: 20px; text-align: center; font-size: 12px; }
    .footer a { color: #90cdf4; }
    .warning { background: #fed7d7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #fc8181; }
    .warning strong { color: #c53030; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your eSIM is Ready!</h1>
      <p>Order ${orderNumber}</p>
    </div>
    
    <div class="content">
      <p>Thank you for your purchase! Your <strong>${productTitle}</strong> eSIM is ready to install.</p>
      
      ${
        region || dataAmount || validity
          ? `
      <div class="details-box">
        <h3>📱 eSIM Details</h3>
        ${region ? `<div class="detail-row"><span class="detail-label">Region</span><span class="detail-value">${region}</span></div>` : ''}
        ${dataAmount ? `<div class="detail-row"><span class="detail-label">Data</span><span class="detail-value">${dataAmount}</span></div>` : ''}
        ${validity ? `<div class="detail-row"><span class="detail-label">Validity</span><span class="detail-value">${validity}</span></div>` : ''}
      </div>
      `
          : ''
      }

      <div class="qr-section">
        <h2>📲 Quick Install</h2>
        <p style="margin-bottom: 20px;">
          <a href="https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(esimPayload.lpa)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
            📱 Install eSIM Now
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
          <em>Tap the button above to install instantly on iPhone, or scan the QR code below:</em>
        </p>
        <div class="qr-code">
          <img src="cid:qrcode" alt="eSIM QR Code" />
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #888;">
          The install button works on iPhone. Android users should scan the QR code.
        </p>
      </div>

      <div class="instructions">
        <h2>📖 How to Install</h2>
        
        <div class="platform">
          <h4>🍎 iPhone (iOS 17.4+)</h4>
          <div class="step">
            <span class="step-number">1</span>
            <span class="step-content">Make sure you're connected to <strong>WiFi</strong></span>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <span class="step-content">Tap the <strong>"Install eSIM Now"</strong> button above (easiest method)</span>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <span class="step-content"><em>OR</em> Go to <strong>Settings → Cellular → Add eSIM</strong> and scan the QR code</span>
          </div>
          <div class="step">
            <span class="step-number">4</span>
            <span class="step-content">After installation, keep the eSIM <strong>turned off</strong> until you arrive at your destination</span>
          </div>
        </div>

        <div class="platform">
          <h4>🤖 Android</h4>
          <div class="step">
            <span class="step-number">1</span>
            <span class="step-content">Make sure you're connected to <strong>WiFi</strong></span>
          </div>
          <div class="step">
            <span class="step-number">2</span>
            <span class="step-content">Go to <strong>Settings → Network & Internet → SIMs</strong></span>
          </div>
          <div class="step">
            <span class="step-number">3</span>
            <span class="step-content">Tap <strong>Add eSIM</strong> or <strong>Download a SIM instead?</strong></span>
          </div>
          <div class="step">
            <span class="step-number">4</span>
            <span class="step-content">Choose <strong>Scan QR code</strong> and scan the code above</span>
          </div>
          <div class="step">
            <span class="step-number">5</span>
            <span class="step-content">After installation, keep the eSIM <strong>turned off</strong> until you arrive</span>
          </div>
        </div>
      </div>
      
      <div class="platform" style="background: #fffbeb; border-left-color: #f59e0b; margin-top: 20px;">
        <h4 style="color: #92400e;">🔌 How to Activate</h4>
        <div class="step">
          <span class="step-number">1</span>
          <span class="step-content">When you arrive at your destination, go to <strong>Settings → Cellular/Mobile</strong></span>
        </div>
        <div class="step">
          <span class="step-number">2</span>
          <span class="step-content">Select your eSIM and <strong>turn it on</strong></span>
        </div>
        <div class="step">
          <span class="step-number">3</span>
          <span class="step-content">Enable <strong>Data Roaming</strong> for the eSIM</span>
        </div>
        <div class="step">
          <span class="step-number">4</span>
          <span class="step-content">If no connection appears, toggle <strong>Airplane Mode</strong> on/off or restart your phone</span>
        </div>
      </div>

      <div class="manual-codes">
        <h3>⌨️ Manual Installation (if QR scan doesn't work)</h3>
        <p>Enter these details manually in your eSIM settings:</p>
        <p><strong>SM-DP+ Address:</strong></p>
        <div class="code-box">${smdpAddress}</div>
        <p><strong>Activation Code:</strong></p>
        <div class="code-box">${esimPayload.activationCode}</div>
        <p><strong>ICCID:</strong></p>
        <div class="code-box">${esimPayload.iccid}</div>
      </div>

      <div class="warning">
        <strong>⚠️ Important Notes:</strong>
        <ul>
          <li>Each QR code can only be installed <strong>once</strong> - keep this email safe</li>
          <li><strong>Install before you travel</strong> (requires WiFi connection)</li>
          <li>Keep the eSIM <strong>turned off</strong> until you reach your destination</li>
          <li>Enable <strong>Data Roaming</strong> when you're ready to use it</li>
          <li>Don't delete the eSIM profile - it cannot be reinstalled</li>
        </ul>
      </div>
    </div>
    
    <div class="footer">
      <p>Need help? Reply to this email or contact our support team.</p>
      <p>© ${new Date().getFullYear()} Fluxify. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Build plain text email content for eSIM delivery
 */
function buildEmailText(data: DeliveryEmailData): string {
  const { orderNumber, productName, esimPayload, region, dataAmount, validity } = data;
  const productTitle = productName || 'Your eSIM';
  const smdpAddress = parseSmdpFromLpa(esimPayload.lpa);

  return `
🎉 Your eSIM is Ready!
Order ${orderNumber}

Thank you for your purchase! Your ${productTitle} eSIM is ready to install.

📱 eSIM DETAILS
${region ? `Region: ${region}` : ''}
${dataAmount ? `Data: ${dataAmount}` : ''}
${validity ? `Validity: ${validity}` : ''}

📲 INSTALLATION
Scan the QR code attached to this email, or use the manual details below.

⌨️ MANUAL INSTALLATION
SM-DP+ Address: ${smdpAddress}
Activation Code: ${esimPayload.activationCode}
ICCID: ${esimPayload.iccid}

📖 INSTRUCTIONS

iPhone (iOS 12.1+):
1. Go to Settings → Cellular → Add eSIM
2. Tap "Use QR Code" and scan
3. Follow prompts to complete installation
4. Enable when you arrive at destination

Android:
1. Go to Settings → Network & Internet → SIMs → Add eSIM
2. Choose "Scan QR code"
3. Scan and confirm installation
4. Enable when ready to use

⚠️ IMPORTANT
- Install BEFORE you travel (requires internet)
- Each eSIM can only be installed ONCE
- Don't delete after installation
- Turn on the eSIM when you arrive

Need help? Reply to this email.

© ${new Date().getFullYear()} Fluxify
`;
}

/**
 * Send eSIM delivery email with QR code
 */
export async function sendDeliveryEmail(
  data: DeliveryEmailData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, orderNumber, esimPayload } = data;

  console.log(`[EmailService] Preparing delivery email for order ${orderNumber} to ${to}`);

  try {
    // Generate QR code
    console.log(
      `[EmailService] Generating QR code for LPA: ${esimPayload.lpa.substring(0, 20)}...`,
    );
    const qrBuffer = await generateQRCodeBuffer(esimPayload.lpa);
    console.log(`[EmailService] QR code generated, size: ${qrBuffer.length} bytes`);

    // Build email content
    console.log(`[EmailService] Building email HTML...`);
    const htmlBody = buildEmailHtml(data);
    console.log(`[EmailService] Building email text...`);
    const textBody = buildEmailText(data);
    console.log(`[EmailService] Email content built`);

    const transporter = getTransporter();
    console.log(`[EmailService] Transporter created:`, !!transporter);

    if (!transporter) {
      // Dry run mode
      console.log(`[EmailService] EMAIL WOULD BE SENT (dry run):`);
      console.log(`  To: ${to}`);
      console.log(`  Subject: Your eSIM is Ready! - Order ${orderNumber}`);
      console.log(`  LPA: ${esimPayload.lpa}`);
      console.log(`  Activation Code: ${esimPayload.activationCode}`);
      console.log(`  ICCID: ${esimPayload.iccid}`);

      return {
        success: true,
        messageId: `dry-run-${Date.now()}`,
      };
    }

    // Send email
    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@example.com';
    const bccEmail = process.env.EMAIL_BCC; // Optional BCC for order tracking

    console.log(
      `[EmailService] Sending email via ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`,
    );
    console.log(`[EmailService] From: ${fromEmail}, To: ${to}, BCC: ${bccEmail || 'none'}`);
    console.log(`[EmailService] About to call sendMail()...`);

    const info = await transporter.sendMail({
      from: fromEmail,
      to: to,
      bcc: bccEmail || undefined, // Send copy to yourself
      subject: `Your eSIM is Ready! - Order ${orderNumber}`,
      text: textBody,
      html: htmlBody,
      attachments: [
        {
          filename: 'esim-qrcode.png',
          content: qrBuffer,
          cid: 'qrcode', // Referenced in HTML as <img src="cid:qrcode" />
        },
      ],
    });

    console.log(`[EmailService] ✅ Email sent successfully: ${info.messageId}`);
    console.log(`[EmailService] Response: ${JSON.stringify(info.response)}`);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[EmailService] ❌ Failed to send email:`, errorMsg);
    console.error(`[EmailService] Full error:`, error);

    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Record email delivery attempt in database
 */
export async function recordDeliveryAttempt(
  prisma: PrismaClient,
  deliveryId: string,
  channel: 'email',
  result: string,
): Promise<void> {
  await prisma.deliveryAttempt.create({
    data: {
      deliveryId,
      channel,
      result,
    },
  });
}
