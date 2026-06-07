export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "student" | "general" | "lecturer";
export type LecturerStatus = "none" | "pending" | "verified" | "rejected";
export type QuestionStatus = "open" | "answered" | "resolved" | "closed";
export type AnswerSource = "user" | "ai";
export type VerificationVerdict = "verified" | "disputed";
export type InteractionType =
  | "question_viewed"
  | "search_performed"
  | "question_created"
  | "answer_created"
  | "vote_cast"
  | "comment_created"
  | "preferred_answer_selected"
  | "answer_saved"
  | "ai_requested"
  | "recommendation_clicked";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
          role: UserRole;
          lecturer_status: LecturerStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          lecturer_status?: LecturerStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          lecturer_status?: LecturerStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          author_id: string;
          subject_id: string | null;
          preferred_answer_id: string | null;
          title: string;
          body: string;
          status: QuestionStatus;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          subject_id?: string | null;
          preferred_answer_id?: string | null;
          title: string;
          body: string;
          status?: QuestionStatus;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject_id?: string | null;
          preferred_answer_id?: string | null;
          title?: string;
          body?: string;
          status?: QuestionStatus;
          view_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      answers: {
        Row: {
          id: string;
          question_id: string;
          author_id: string | null;
          source: AnswerSource;
          body: string;
          ai_draft_id: string | null;
          score: number;
          is_low_quality: boolean;
          is_collapsed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          author_id?: string | null;
          source?: AnswerSource;
          body: string;
          ai_draft_id?: string | null;
          score?: number;
          is_low_quality?: boolean;
          is_collapsed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          score?: number;
          is_low_quality?: boolean;
          is_collapsed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      lecturer_status: LecturerStatus;
      question_status: QuestionStatus;
      answer_source: AnswerSource;
      verification_verdict: VerificationVerdict;
      interaction_type: InteractionType;
    };
  };
};
