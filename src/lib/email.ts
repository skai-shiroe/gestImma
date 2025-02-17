import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: Bun.env.EMAIL_USER, // Ton email Gmail
    pass: Bun.env.EMAIL_PASS, // Ton mot de passe d'application Gmail
  },
});

export const sendResetPasswordEmail = async (email: string, token: string) => {
  const resetUrl = `http://localhost:3000/reset-password?token=${token}`;

  try {
    const info = await transporter.sendMail({
      from: `"Support" <${Bun.env.EMAIL_USER}>`, // Expéditeur
      to: email, // Destinataire
      subject: "Réinitialisation de votre mot de passe",
      html: `<p>Pour réinitialiser votre mot de passe, cliquez sur ce lien : <a href="${resetUrl}">${resetUrl}</a></p>`,
    });

    console.log("Email envoyé :", info.messageId);
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail :", error);
    throw new Error("Erreur lors de l'envoi de l'e-mail.");
  }
};
