export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "student" | "general" | "lecturer";
export type LecturerStatus = "none" | "pending" | "verified" | "rejected";
export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type QuestionStatus = "open" | "answered" | "resolved" | "closed";
export type AnswerSource = "user" | "ai";
export type VerificationVerdict = "verified" | "disputed";
export type InteractionType =
  | "question_viewed"
  | "search_performed"
  | "tag_clicked"
  | "question_created"
  | "answer_created"
  | "answer_posted"
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
          skill_level: SkillLevel | null;
          preferences: Json;
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
          skill_level?: SkillLevel | null;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          lecturer_status?: LecturerStatus;
          skill_level?: SkillLevel | null;
          preferences?: Json;
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
      question_tags: {
        Row: {
          question_id: string;
          tag_id: string;
        };
        Insert: {
          question_id: string;
          tag_id: string;
        };
        Update: {
          question_id?: string;
          tag_id?: string;
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
      answer_votes: {
        Row: {
          answer_id: string;
          voter_id: string;
          value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          answer_id: string;
          voter_id: string;
          value: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          value?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      answer_verifications: {
        Row: {
          id: string;
          answer_id: string;
          lecturer_id: string;
          verdict: VerificationVerdict;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          answer_id: string;
          lecturer_id: string;
          verdict: VerificationVerdict;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          verdict?: VerificationVerdict;
          note?: string | null;
        };
        Relationships: [];
      };
      answer_comments: {
        Row: {
          id: string;
          answer_id: string;
          author_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          answer_id: string;
          author_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_interactions: {
        Row: {
          id: string;
          user_id: string | null;
          interaction_type: InteractionType;
          question_id: string | null;
          answer_id: string | null;
          tag_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          interaction_type: InteractionType;
          question_id?: string | null;
          answer_id?: string | null;
          tag_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          interaction_type?: InteractionType;
          question_id?: string | null;
          answer_id?: string | null;
          tag_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      recommendation_events: {
        Row: {
          id: string;
          user_id: string | null;
          question_id: string | null;
          answer_id: string | null;
          algorithm_version: string;
          rank_position: number | null;
          score: number | null;
          clicked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          question_id?: string | null;
          answer_id?: string | null;
          algorithm_version: string;
          rank_position?: number | null;
          score?: number | null;
          clicked?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          question_id?: string | null;
          answer_id?: string | null;
          algorithm_version?: string;
          rank_position?: number | null;
          score?: number | null;
          clicked?: boolean;
          created_at?: string;
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
