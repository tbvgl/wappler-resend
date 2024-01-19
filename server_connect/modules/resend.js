const { Resend } = require("resend");
const fs = require("fs").promises;
const { toSystemPath } = require("../../../lib/core/path");

exports.send_resend_email = async function (options) {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFromEmail = process.env.EMAIL_FROM;
  const recipients = options.to.split(",").map((email) => email.trim());
  const ccRecipients = options.cc
    ? options.cc.split(",").map((email) => email.trim())
    : [];
  const bccRecipients = options.bcc
    ? options.bcc.split(",").map((email) => email.trim())
    : [];

  if (!apiKey) {
    throw new Error("Resend API key is not set in environment variables.");
  }

  const resend = new Resend(apiKey);

  const fromEmail =
    this.parseOptional(options.from, "string", "") || defaultFromEmail;
  if (!fromEmail) {
    throw new Error(
      "No 'from' email address is provided in the options, and the EMAIL_FROM environment variable is not set."
    );
  }
  const fromName = options.fromName ? options.fromName.trim() : "";
  const formattedFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const preheaderHtml = options.preheader
    ? `<span style="display: none; font-size: 1px; color: #ffffff;">${options.preheader}</span>`
    : "";
  const fullHtmlContent = `${preheaderHtml}${options.html}`.replace(/\n/g, "");

  const replyTo =
    this.parseOptional(options.reply_to, "string", "") || fromEmail;

  const tags = options.tags || [];

  const attachments = (options.attachments || []).map((attachment) => {
    if (attachment.path && attachment.filename) {
      const systemPath = toSystemPath(attachment.path);
      return fs.readFile(systemPath).then((content) => ({
        filename: attachment.filename,
        content: content,
      }));
    } else {
      throw new Error(
        "Both filename and path must be provided for attachments."
      );
    }
  });
  const emailData = {
    from: formattedFrom,
    to: recipients,
    subject: this.parseRequired(
      options.subject,
      "string",
      "Email subject is required."
    ),
    html: this.parseRequired(
      fullHtmlContent,
      "string",
      "HTML content is required."
    ),
    replyTo: replyTo,
    cc: ccRecipients.length > 0 ? ccRecipients : undefined,
    bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
    text: options.text,
    tags: tags,
    attachments: await Promise.all(attachments),
  };

  console.log("Email Data:", emailData);

  try {
    const response = await resend.emails.send(emailData);

    return {
      id: response.data ? response.data.id : null,
      error: response.error ? response.error : null,
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return { id: null, error: error.message || "Failed to send email." };
  }
};
