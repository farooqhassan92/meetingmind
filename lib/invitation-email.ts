type InvitationEmailInput = {
  email: string;
  invitedByName: string | null;
  organizationName: string;
  organizationRole: string;
  teamName: string | null;
  teamRole: string | null;
  token: string;
};

type InvitationEmailResult =
  | {
      messageId: string | null;
      sent: true;
    }
  | {
      error: string;
      sent: false;
    };

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function appUrl() {
  return (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function fromAddress() {
  return process.env.INVITE_FROM_EMAIL ?? "MeetingMind <onboarding@resend.dev>";
}

function inviteUrl(token: string) {
  return `${appUrl()}/invite/${token}`;
}

function inviteText(input: InvitationEmailInput) {
  const inviter = input.invitedByName ?? "A MeetingMind workspace admin";
  const teamLine = input.teamName
    ? `Team: ${input.teamName} (${input.teamRole ?? "MEMBER"})`
    : "Team: Not assigned yet";

  return [
    `${inviter} invited you to join ${input.organizationName} on MeetingMind.`,
    "",
    `Organization role: ${input.organizationRole}`,
    teamLine,
    "",
    `Accept your invite: ${inviteUrl(input.token)}`,
    "",
    "This invitation expires in 7 days."
  ].join("\n");
}

function inviteHtml(input: InvitationEmailInput) {
  const inviter = input.invitedByName ?? "A MeetingMind workspace admin";
  const teamLine = input.teamName
    ? `${input.teamName} (${input.teamRole ?? "MEMBER"})`
    : "Not assigned yet";

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 20px; margin-bottom: 12px;">You're invited to MeetingMind</h1>
      <p>${inviter} invited you to join <strong>${input.organizationName}</strong>.</p>
      <p><strong>Organization role:</strong> ${input.organizationRole}</p>
      <p><strong>Team:</strong> ${teamLine}</p>
      <p>
        <a href="${inviteUrl(input.token)}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none;">
          Accept invite
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">This invitation expires in 7 days.</p>
    </div>
  `;
}

export async function sendInvitationEmail(
  input: InvitationEmailInput
): Promise<InvitationEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      error: "Email is not configured. Set RESEND_API_KEY to send invites.",
      sent: false
    };
  }

  let response: Response;

  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress(),
        html: inviteHtml(input),
        subject: `Join ${input.organizationName} on MeetingMind`,
        text: inviteText(input),
        to: [input.email]
      })
    });
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : "Email request failed.",
      sent: false
    };
  }

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;

  if (!response.ok) {
    return {
      error:
        payload.message ??
        payload.name ??
        `Email provider returned status ${response.status}.`,
      sent: false
    };
  }

  return {
    messageId: payload.id ?? null,
    sent: true
  };
}
