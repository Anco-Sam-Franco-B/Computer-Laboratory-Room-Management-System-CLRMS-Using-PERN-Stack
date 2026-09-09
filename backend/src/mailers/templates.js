const { sendMail, layout, btn } = require('./mailer');
const { createNotification } = require('../utils/notificationHelper');

/** Compose and send a templated email, and (optionally) enqueue an in-app notification. */
async function sendEmailNotification({ user, title, contentHtml, link, linkLabel, category }) {
  const subject = `[CLRMS] ${title}`;
  await sendMail({ to: user.email, subject, html: layout(title, contentHtml + (link ? btn(link, linkLabel || 'Open') : '')) });

  if (category) {
    await createNotification({
      user_id: user.id,
      type: 'info',
      title,
      message: contentHtml.replace(/<[^>]+>/g, ''),
      link,
      data: { category },
    });
  }
}

module.exports = {
  sendVerificationEmail(user, tokenLink) {
    return sendEmailNotification({
      user,
      title: 'Confirm your email address',
      contentHtml: `Hi ${user.first_name}, <br/> Please confirm your email address to activate your account:`,
      link: tokenLink,
      linkLabel: 'Confirm email',
      category: 'auth',
    });
  },

  sendPasswordResetEmail(user, tokenLink) {
    return sendEmailNotification({
      user,
      title: 'Reset your password',
      contentHtml: `Hi ${user.first_name}, <br/> We received a request to reset your password. This link is valid for 15 minutes:`,
      link: tokenLink,
      linkLabel: 'Reset password',
      category: 'auth',
    });
  },

  sendWelcomeEmail(user) {
    return sendEmailNotification({
      user,
      title: 'Welcome to CLRMS 👋',
      contentHtml: `Hi ${user.first_name}, <br/> Your account was created. You can now sign in and explore the platform.`,
      link: `${process.env.CLIENT_URL}/login`,
      linkLabel: 'Sign in',
      category: 'auth',
    });
  },
};