import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

// Edit this list to control which school domains may apply.
const ALLOWED_SCHOOL_EMAIL_DOMAINS = ["sunway.edu.my", "imail.sunway.edu.my"];

const EVIDENCE_BUCKET = "lecturer-evidence";
const MAX_EVIDENCE_FILES = 4;
const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EVIDENCE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

type VerificationPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

function buildMessageRedirect(status: string, message: string) {
  const url = new URL(
    "/profile/verification",
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return `${url.pathname}${url.search}`;
}

function isAllowedSchoolEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return false;
  }

  const domain = email.split("@")[1].toLowerCase();
  return ALLOWED_SCHOOL_EMAIL_DOMAINS.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() || "evidence";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

function asEvidencePathList(value: Json | null | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

async function submitApplication(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const institution = String(formData.get("institution") || "").trim();
  const schoolEmail = String(formData.get("schoolEmail") || "")
    .trim()
    .toLowerCase();
  const staffId = String(formData.get("staffId") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const files = formData
    .getAll("evidence")
    .filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );

  if (!institution) {
    redirect(buildMessageRedirect("error", "Institution is required."));
  }

  if (!isAllowedSchoolEmail(schoolEmail)) {
    redirect(
      buildMessageRedirect(
        "error",
        `Use a valid school email from: ${ALLOWED_SCHOOL_EMAIL_DOMAINS.join(", ")}.`,
      ),
    );
  }

  if (!staffId) {
    redirect(buildMessageRedirect("error", "Staff ID is required."));
  }

  if (!files.length) {
    redirect(
      buildMessageRedirect(
        "error",
        "Attach at least one evidence document (offer/employment letter or pay slip).",
      ),
    );
  }

  if (files.length > MAX_EVIDENCE_FILES) {
    redirect(
      buildMessageRedirect(
        "error",
        `Attach at most ${MAX_EVIDENCE_FILES} files.`,
      ),
    );
  }

  for (const file of files) {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.type)) {
      redirect(
        buildMessageRedirect(
          "error",
          `"${file.name}" is not a PDF, JPEG, or PNG file.`,
        ),
      );
    }
    if (file.size > MAX_EVIDENCE_FILE_BYTES) {
      redirect(
        buildMessageRedirect("error", `"${file.name}" is larger than 5MB.`),
      );
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, lecturer_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "lecturer" || profile?.lecturer_status === "verified") {
    redirect(
      buildMessageRedirect("info", "You are already a verified lecturer."),
    );
  }

  if (profile?.lecturer_status === "pending") {
    redirect(
      buildMessageRedirect(
        "info",
        "Your application is already under review.",
      ),
    );
  }

  const evidencePaths: string[] = [];
  for (const file of files) {
    const path = `${user.id}/${Date.now()}-${cleanFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      redirect(
        buildMessageRedirect(
          "error",
          `Could not upload "${file.name}": ${uploadError.message}`,
        ),
      );
    }

    evidencePaths.push(path);
  }

  const { error: insertError } = await supabase
    .from("lecturer_verification_requests")
    .insert({
      user_id: user.id,
      institution,
      school_email: schoolEmail,
      staff_id: staffId,
      note: note || null,
      evidence_paths: evidencePaths,
    });

  if (insertError) {
    const friendly =
      insertError.code === "23505"
        ? "You already have a pending application. Please wait for it to be reviewed."
        : insertError.message;
    redirect(buildMessageRedirect("error", friendly));
  }

  revalidatePath("/profile");
  revalidatePath("/profile/verification");
  redirect(
    buildMessageRedirect(
      "success",
      "Application submitted. We will review it shortly.",
    ),
  );
}

export default async function LecturerVerificationPage({
  searchParams,
}: VerificationPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const [{ data: profile }, { data: latestRequest }] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, lecturer_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("lecturer_verification_requests")
      .select(
        "id, institution, school_email, staff_id, note, evidence_paths, status, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const params = await searchParams;
  const status = params.status;
  const message = params.message;

  const isVerified =
    profile?.role === "lecturer" || profile?.lecturer_status === "verified";
  const isPending = !isVerified && profile?.lecturer_status === "pending";
  const isRejected = !isVerified && profile?.lecturer_status === "rejected";
  const showForm = !isVerified && !isPending;
  const evidenceNames = asEvidencePathList(latestRequest?.evidence_paths).map(
    (path) => path.split("/").pop() || path,
  );

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <div className="profile-hero profile-settings-hero">
          <div className="profile-hero-head">
            <Link className="profile-back" href="/profile">
              Back to profile
            </Link>
            <Link className="profile-back" href="/">
              Home
            </Link>
          </div>
          <div className="profile-intro">
            <span className="eyebrow">Lecturer verification</span>
            <h1>Apply for Verification</h1>
            <p>
              Verified lecturers can endorse or dispute answers. Submit your
              school email, staff ID, and evidence documents for review.
            </p>
          </div>
        </div>

        <section className="profile-card profile-settings-card">
          {isVerified ? (
            <div className="profile-empty">
              <strong>
                <span className="badge success">Verified lecturer</span>
              </strong>
              <span>
                Your account is verified. You can verify and dispute answers
                across Peerly.
              </span>
            </div>
          ) : null}

          {isPending && latestRequest ? (
            <>
              <div className="profile-empty">
                <strong>Application submitted — under review</strong>
                <span>
                  Submitted on {formatDate(latestRequest.created_at)}. You will
                  see your status change on your profile once it is reviewed.
                </span>
              </div>
              <ul className="profile-list">
                <li>
                  <strong>Institution</strong>
                  <span>{latestRequest.institution || "Not provided"}</span>
                </li>
                <li>
                  <strong>School email</strong>
                  <span>{latestRequest.school_email || "Not provided"}</span>
                </li>
                <li>
                  <strong>Staff ID</strong>
                  <span>{latestRequest.staff_id || "Not provided"}</span>
                </li>
                <li>
                  <strong>Evidence documents</strong>
                  <span>
                    {evidenceNames.length
                      ? evidenceNames.join(", ")
                      : "Not provided"}
                  </span>
                </li>
                {latestRequest.note ? (
                  <li>
                    <strong>Note</strong>
                    <span>{latestRequest.note}</span>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}

          {isPending && !latestRequest ? (
            <div className="profile-empty">
              <strong>Application under review</strong>
              <span>
                Your lecturer verification is being reviewed. Check back soon.
              </span>
            </div>
          ) : null}

          {isRejected ? (
            <div className="profile-empty">
              <strong>Your previous application was rejected</strong>
              <span>
                You can submit a new application below with updated details and
                evidence.
              </span>
            </div>
          ) : null}

          {showForm ? (
            <form action={submitApplication} className="profile-form">
              <div className="field">
                <label htmlFor="institution">Institution</label>
                <input
                  id="institution"
                  name="institution"
                  placeholder="e.g. Sunway University"
                  required
                  type="text"
                />
              </div>

              <div className="field">
                <label htmlFor="schoolEmail">School email</label>
                <input
                  id="schoolEmail"
                  name="schoolEmail"
                  placeholder="you@sunway.edu.my"
                  required
                  type="email"
                />
                <span>
                  Accepted domains: {ALLOWED_SCHOOL_EMAIL_DOMAINS.join(", ")}
                </span>
              </div>

              <div className="field">
                <label htmlFor="staffId">Staff ID</label>
                <input
                  id="staffId"
                  name="staffId"
                  placeholder="Your staff ID"
                  required
                  type="text"
                />
              </div>

              <div className="field">
                <label htmlFor="evidence">Evidence documents</label>
                <input
                  accept=".pdf,.jpg,.jpeg,.png"
                  id="evidence"
                  multiple
                  name="evidence"
                  required
                  type="file"
                />
                <span>
                  Attach your offer/employment letter and/or a recent pay slip.
                  PDF, JPG, or PNG, up to 5MB each (max {MAX_EVIDENCE_FILES}{" "}
                  files). Files are stored privately and only used for review.
                </span>
              </div>

              <div className="field">
                <label htmlFor="note">Note (optional)</label>
                <input
                  id="note"
                  name="note"
                  maxLength={300}
                  placeholder="Anything the reviewer should know"
                  type="text"
                />
              </div>

              <div className="profile-actions">
                <button className="btn primary" type="submit">
                  Submit application
                </button>
                <Link href="/profile">Cancel</Link>
              </div>
            </form>
          ) : null}

          {message ? (
            <p className="auth-status" data-state={status || "info"}>
              {message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
