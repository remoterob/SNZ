


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."agm_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."agm_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bigfish_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."bigfish_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bingo_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin new.updated_at = now(); return new; end;
$$;


ALTER FUNCTION "public"."bingo_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_member_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    NEW.member_number := 'SNZ-2026-' || LPAD(
      (COALESCE((SELECT MAX(SUBSTRING(member_number FROM 10)::int) FROM members WHERE member_number LIKE 'SNZ-2026-%'), 0) + 1)::text,
      4, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_member_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_heaviest_fish_leader"() RETURNS TABLE("team_id" "uuid", "team_number" integer, "team_names" "text", "weight_grams" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.team_id,
    l.team_number,
    l.team_names,
    l.heaviest_fish_grams
  FROM leaderboard l
  WHERE l.eligible = true 
    AND l.status != 'disqualified'
    AND l.heaviest_fish_grams IS NOT NULL
  ORDER BY l.heaviest_fish_grams DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_heaviest_fish_leader"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_lightest_fish_leader"() RETURNS TABLE("team_id" "uuid", "team_number" integer, "team_names" "text", "weight_grams" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.team_id,
    l.team_number,
    l.team_names,
    l.lightest_fish_grams
  FROM leaderboard l
  WHERE l.eligible = true 
    AND l.status != 'disqualified'
    AND l.lightest_fish_grams IS NOT NULL
  ORDER BY l.lightest_fish_grams ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_lightest_fish_leader"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fish_species_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_fish_species_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agm_attendees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'self'::"text" NOT NULL,
    "checked_in_by" "uuid",
    "checked_in_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agm_attendees_source_check" CHECK (("source" = ANY (ARRAY['self'::"text", 'secretary'::"text"])))
);


ALTER TABLE "public"."agm_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agm_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "kind" "text" DEFAULT 'AGM'::"text" NOT NULL,
    "meeting_date" timestamp with time zone NOT NULL,
    "location" "text",
    "virtual_join_url" "text",
    "notes" "text",
    "motions_visible_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agm_meetings_kind_check" CHECK (("kind" = ANY (ARRAY['AGM'::"text", 'SGM'::"text"]))),
    CONSTRAINT "agm_meetings_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'open'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."agm_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agm_motions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "order_no" integer DEFAULT 0 NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "mover_name" "text",
    "seconder_name" "text",
    "voting_mode" "text" DEFAULT 'open'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result" "text",
    "chair_casting_vote" "text",
    "floor_for" integer DEFAULT 0 NOT NULL,
    "floor_against" integer DEFAULT 0 NOT NULL,
    "floor_abstain" integer DEFAULT 0 NOT NULL,
    "opened_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agm_motions_chair_casting_vote_check" CHECK (("chair_casting_vote" = ANY (ARRAY['for'::"text", 'against'::"text"]))),
    CONSTRAINT "agm_motions_result_check" CHECK (("result" = ANY (ARRAY['passed'::"text", 'failed'::"text", 'tied'::"text", 'casting_for'::"text", 'casting_against'::"text"]))),
    CONSTRAINT "agm_motions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'open'::"text", 'closed'::"text"]))),
    CONSTRAINT "agm_motions_voting_mode_check" CHECK (("voting_mode" = ANY (ARRAY['open'::"text", 'secret'::"text"])))
);


ALTER TABLE "public"."agm_motions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agm_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "motion_id" "uuid" NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "vote" "text" NOT NULL,
    "voted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agm_votes_vote_check" CHECK (("vote" = ANY (ARRAY['for'::"text", 'against'::"text", 'abstain'::"text"])))
);


ALTER TABLE "public"."agm_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bigfish_comps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "species" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "champion_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bigfish_comps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bigfish_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comp_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "weight_kg" numeric(6,2) NOT NULL,
    "length_cm" numeric(6,1) NOT NULL,
    "photo_glory_url" "text",
    "photo_scales_url" "text",
    "photo_length_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bigfish_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bigfish_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comp_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bigfish_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bigfish_sponsor_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "website" "text",
    "offer_description" "text" NOT NULL,
    "offer_value" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bigfish_sponsor_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_bonuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "bonus_type" "text" DEFAULT 'evergreen'::"text" NOT NULL,
    "month" integer,
    "points" integer DEFAULT 0 NOT NULL,
    "species" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bingo_bonuses_bonus_type_check" CHECK (("bonus_type" = ANY (ARRAY['monthly'::"text", 'evergreen'::"text"]))),
    CONSTRAINT "bingo_bonuses_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."bingo_bonuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "species_slug" "text" NOT NULL,
    "first_time" boolean DEFAULT false NOT NULL,
    "photo_url" "text",
    "thumb_url" "text",
    "comp_season" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bingo_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_comp_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season" "text" NOT NULL,
    "comp_start" timestamp with time zone NOT NULL,
    "comp_end" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bingo_comp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_dishes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "photo_url" "text",
    "recipe_link" "text",
    "species_slug" "text",
    "comp_season" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bingo_dishes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bingo_species" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "points" integer DEFAULT 100 NOT NULL,
    "image_path" "text",
    "tips" "text",
    "recipe_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bingo_species" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."buddy_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid",
    "events" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "skill_level" "text",
    "ambition" "text"[] DEFAULT '{}'::"text"[],
    "other_info" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."buddy_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catches" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "catfish_count" integer NOT NULL,
    "heaviest_fish_grams" integer,
    "lightest_fish_grams" integer,
    "photo_urls" "text"[],
    "status" "text" DEFAULT 'provisional'::"text" NOT NULL,
    "protest_notes" "text",
    "weighmaster_id" "text",
    "email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "catches_catfish_count_check" CHECK (("catfish_count" >= 0)),
    CONSTRAINT "catches_heaviest_fish_grams_check" CHECK (("heaviest_fish_grams" > 0)),
    CONSTRAINT "catches_lightest_fish_grams_check" CHECK (("lightest_fish_grams" > 0)),
    CONSTRAINT "catches_status_check" CHECK (("status" = ANY (ARRAY['provisional'::"text", 'under_protest'::"text", 'confirmed'::"text", 'disqualified'::"text"])))
);


ALTER TABLE "public"."catches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comp_boats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_id" bigint NOT NULL,
    "boat_name" "text" NOT NULL,
    "skipper_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comp_boats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comp_fish" (
    "id" bigint NOT NULL,
    "competition_id" bigint,
    "species_name" "text" NOT NULL,
    "species_slug" "text" NOT NULL,
    "photo_url" "text",
    "points" integer DEFAULT 100,
    "max_weight_kg" numeric DEFAULT 8,
    "allow_multiples" boolean DEFAULT false,
    "max_count" integer DEFAULT 1,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "weigh_separately" boolean DEFAULT false,
    "division" "text",
    "category_points" "jsonb"
);


ALTER TABLE "public"."comp_fish" OWNER TO "postgres";


ALTER TABLE "public"."comp_fish" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comp_fish_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comp_species_library" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "photo_url" "text",
    "sort_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comp_species_library" OWNER TO "postgres";


ALTER TABLE "public"."comp_species_library" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comp_species_library_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comp_team_members" (
    "id" bigint NOT NULL,
    "team_id" bigint,
    "competition_id" bigint,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "club" "text",
    "gender" "text",
    "dob" "text",
    "emergency_contact" "text",
    "emergency_phone" "text",
    "fit_to_dive" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "merch_type" "text",
    "merch_size" "text",
    "merch_late" boolean DEFAULT false,
    "skill_level" "text"
);


ALTER TABLE "public"."comp_team_members" OWNER TO "postgres";


ALTER TABLE "public"."comp_team_members" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comp_team_members_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comp_teams" (
    "id" bigint NOT NULL,
    "competition_id" bigint,
    "team_name" "text" NOT NULL,
    "category" "text" DEFAULT 'Open'::"text" NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    "team_photo_url" "text",
    "rules_accepted" boolean DEFAULT false,
    "waiver_accepted" boolean DEFAULT false,
    "acceptance_at" timestamp with time zone,
    "diver1_member_id" "uuid",
    "diver2_email" "text",
    "diver2_member_id" "uuid",
    "diver2_invite_sent" boolean DEFAULT false,
    "payment_status" "text" DEFAULT 'free'::"text",
    "stripe_session_id" "text",
    "stripe_payment_intent" "text",
    "paid_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending_diver2'::"text",
    "diver2_accepted_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    "withdrawn_by" "uuid",
    "nationals_event" "jsonb",
    "diver2_payment_status" "text" DEFAULT 'pending'::"text",
    "merch_d1" "jsonb",
    "merch_d2" "jsonb",
    "entry_fee_cents" integer,
    "stripe_payment_intent_id" "text",
    "boat_name" "text",
    "boat_details" "text",
    "boat_id" "uuid",
    "checked_in" boolean DEFAULT false NOT NULL,
    "checked_in_at" timestamp with time zone,
    "catfish_count" integer,
    "heaviest_fish_grams" integer,
    "lightest_fish_grams" integer,
    "result_status" "text" DEFAULT 'provisional'::"text",
    CONSTRAINT "comp_teams_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'withdrawn'::"text", 'pending_diver2'::"text", 'pending_payment'::"text"])))
);


ALTER TABLE "public"."comp_teams" OWNER TO "postgres";


ALTER TABLE "public"."comp_teams" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comp_teams_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."comp_weighins" (
    "id" bigint NOT NULL,
    "competition_id" bigint,
    "team_id" bigint,
    "fish_id" bigint,
    "fish_name" "text" NOT NULL,
    "weight_kg" numeric,
    "points_awarded" integer DEFAULT 0 NOT NULL,
    "instance" integer DEFAULT 1,
    "weighed_at" timestamp with time zone DEFAULT "now"(),
    "catch_photo_url" "text",
    "is_bulk" boolean DEFAULT false,
    "division" "text",
    "day" smallint
);


ALTER TABLE "public"."comp_weighins" OWNER TO "postgres";


ALTER TABLE "public"."comp_weighins" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."comp_weighins_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."competitions" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "club_name" "text",
    "date_start" "date",
    "date_end" "date",
    "location" "text",
    "details" "text",
    "rules" "text",
    "scoring_mode" "text" DEFAULT 'standard'::"text" NOT NULL,
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "public_leaderboard" boolean DEFAULT true,
    "club_password" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "cover_image_url" "text",
    "event_info" "text",
    "sponsor1_url" "text",
    "sponsor2_url" "text",
    "sponsor3_url" "text",
    "compliance_accepted" boolean DEFAULT false,
    "compliance_accepted_at" timestamp with time zone,
    "compliance_accepted_by" "text",
    "entry_fee_cents" integer DEFAULT 0,
    "registration_cutoff" "date",
    "merch_enabled" boolean DEFAULT false,
    "merch_types" "text"[] DEFAULT '{}'::"text"[],
    "merch_sizes" "text"[] DEFAULT '{}'::"text"[],
    "merch_cutoff" "date",
    "category_fees" "jsonb" DEFAULT '{}'::"jsonb",
    "early_bird_cutoff" timestamp with time zone,
    "nationals_event" "jsonb",
    "diver2_payment_status" "text" DEFAULT 'pending'::"text",
    "event_dates" "jsonb" DEFAULT '{}'::"jsonb",
    "hidden_from_list" boolean DEFAULT false,
    "combined_leaderboard" boolean DEFAULT false,
    "merch_prices" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "competitions_scoring_mode_check" CHECK (("scoring_mode" = ANY (ARRAY['standard'::"text", 'standard_self_submit'::"text", 'fish_bingo'::"text", 'fish_bingo_individual'::"text", 'catfish_count'::"text"])))
);


ALTER TABLE "public"."competitions" OWNER TO "postgres";


ALTER TABLE "public"."competitions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."competitions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."copilot_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mode" "text" NOT NULL,
    "competition_id" "text",
    "session_id" "text",
    "question" "text" NOT NULL,
    "response_length_chars" integer,
    "quick_action_id" "text",
    "response_time_ms" integer,
    "error" "text",
    CONSTRAINT "copilot_events_mode_check" CHECK (("mode" = ANY (ARRAY['admin'::"text", 'competitor'::"text"])))
);


ALTER TABLE "public"."copilot_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_state" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "status" "text" DEFAULT 'registration'::"text" NOT NULL,
    "protest_deadline" time without time zone,
    "prizegiving_time" time without time zone,
    "competition_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_state_status_check" CHECK (("status" = ANY (ARRAY['registration'::"text", 'briefing'::"text", 'weighin'::"text", 'provisional'::"text", 'final'::"text"])))
);


ALTER TABLE "public"."event_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fish_species" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "common_name" "text" NOT NULL,
    "scientific_name" "text",
    "aka_names" "text"[] DEFAULT '{}'::"text"[],
    "tips" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fish_species" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fish_species_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "species_id" "uuid" NOT NULL,
    "photo_url" "text" NOT NULL,
    "caption" "text",
    "is_hero" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."fish_species_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "team_number" integer NOT NULL,
    "division" "text",
    "competitor1_name" "text" NOT NULL,
    "competitor1_email" "text" NOT NULL,
    "competitor2_name" "text" NOT NULL,
    "competitor2_email" "text" NOT NULL,
    "competitor3_name" "text",
    "competitor3_email" "text",
    "club" "text",
    "notes" "text",
    "checked_in" boolean DEFAULT false,
    "biosecurity_signed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_junior" boolean DEFAULT false,
    "is_women" boolean DEFAULT false,
    "registered" boolean DEFAULT false,
    "attended_briefing" boolean DEFAULT false,
    "tshirt1" "text",
    "tshirt1_taken" boolean DEFAULT false,
    "tshirt2" "text",
    "tshirt2_taken" boolean DEFAULT false,
    "tshirt3" "text",
    "tshirt3_taken" boolean DEFAULT false,
    "is_mixed" boolean DEFAULT false,
    CONSTRAINT "teams_division_check" CHECK (("division" = ANY (ARRAY['Open'::"text", 'Women'::"text", 'Juniors'::"text"])))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard" AS
 SELECT "c"."id",
    "c"."team_id",
    "c"."catfish_count",
    "c"."heaviest_fish_grams",
    "c"."lightest_fish_grams",
    "c"."photo_urls",
    "c"."status",
    "c"."protest_notes",
    "c"."created_at",
    "t"."team_number",
    "t"."division",
    "t"."competitor1_name",
    "t"."competitor1_email",
    "t"."competitor2_name",
    "t"."competitor2_email",
    "t"."competitor3_name",
    "t"."competitor3_email",
    "t"."club",
    "t"."notes",
    "t"."is_junior",
    "t"."is_women",
    "t"."is_mixed",
    (NOT (("t"."competitor3_name" IS NOT NULL) AND ("t"."competitor3_name" <> ''::"text"))) AS "eligible"
   FROM ("public"."catches" "c"
     JOIN "public"."teams" "t" ON (("c"."team_id" = "t"."id")))
  ORDER BY "c"."catfish_count" DESC;


ALTER VIEW "public"."leaderboard" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."leaderboard_counts" AS
 SELECT "count"(*) AS "total_teams",
    "count"(*) FILTER (WHERE "is_women") AS "women_teams",
    "count"(*) FILTER (WHERE "is_junior") AS "junior_teams",
    "count"(*) FILTER (WHERE "is_mixed") AS "mixed_teams"
   FROM "public"."teams";


ALTER VIEW "public"."leaderboard_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."member_competitions" (
    "id" bigint NOT NULL,
    "member_id" "uuid",
    "competition_id" bigint,
    "team_id" bigint,
    "year" integer DEFAULT 2026,
    "linked_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."member_competitions" OWNER TO "postgres";


ALTER TABLE "public"."member_competitions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."member_competitions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."member_whitelist" (
    "id" bigint NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."member_whitelist" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."member_whitelist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."member_whitelist_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."member_whitelist_id_seq" OWNED BY "public"."member_whitelist"."id";



CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "phone" "text",
    "club" "text",
    "gender" "text",
    "dob" "date",
    "emergency_contact" "text",
    "emergency_phone" "text",
    "experience" "text",
    "region" "text",
    "membership_year" integer DEFAULT 2026,
    "membership_expires" "date" DEFAULT '2026-12-31'::"date",
    "membership_status" "text" DEFAULT 'active'::"text",
    "member_number" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "fit_to_dive" boolean DEFAULT false,
    "payment_status" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "stripe_payment_intent" "text",
    "paid_at" timestamp with time zone,
    "membership_fee_cents" integer DEFAULT 1000,
    "cancelled_at" timestamp with time zone,
    "data_removal_requested_at" timestamp with time zone,
    "stripe_session_id" "text"
);


ALTER TABLE "public"."members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."near_miss_rate_limit" (
    "id" bigint NOT NULL,
    "ip" "text" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."near_miss_rate_limit" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."near_miss_rate_limit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."near_miss_rate_limit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."near_miss_rate_limit_id_seq" OWNED BY "public"."near_miss_rate_limit"."id";



CREATE TABLE IF NOT EXISTS "public"."near_miss_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "submitted_as_member" boolean DEFAULT false NOT NULL,
    "time_band" "text" NOT NULL,
    "approx_month_year" "text",
    "region" "text" NOT NULL,
    "location_name" "text" NOT NULL,
    "distance_from_shore" "text" NOT NULL,
    "latitude" numeric(9,6),
    "longitude" numeric(9,6),
    "outcome" "text" NOT NULL,
    "closest_distance" "text" NOT NULL,
    "vessel_speed" "text" NOT NULL,
    "diver_position" "text" NOT NULL,
    "visibility_gear" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "vessel_saw_you" "text" NOT NULL,
    "vessel_type" "text" NOT NULL,
    "reported_to" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "not_reported_reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "report_outcome" "text",
    "injury_level" "text" NOT NULL,
    "years_experience" "text",
    "days_per_year" "text",
    "club_member" "text",
    "free_text" "text",
    "contact_consent" "text" NOT NULL,
    "contact_email" "text",
    "data_use_consent" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "moderation_note" "text",
    "submission_source" "text" DEFAULT 'web'::"text"
);


ALTER TABLE "public"."near_miss_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."nz_records" (
    "id" bigint NOT NULL,
    "species" "text" NOT NULL,
    "weight_kg" numeric,
    "diver" "text",
    "club" "text",
    "date_caught" "text",
    "location" "text",
    "division" "text" NOT NULL,
    "verified" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "photo_url" "text",
    "provisional" boolean DEFAULT false,
    "provisional_since" timestamp with time zone
);


ALTER TABLE "public"."nz_records" OWNER TO "postgres";


ALTER TABLE "public"."nz_records" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."nz_records_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."page_views" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "path" "text" NOT NULL,
    "referrer" "text",
    "member_id" "uuid",
    "session_id" "text",
    "device_type" "text",
    "browser" "text",
    "os" "text",
    "screen_width" integer,
    "screen_height" integer,
    "country" "text",
    "duration_ms" integer
);


ALTER TABLE "public"."page_views" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."page_views_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."page_views_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."page_views_id_seq" OWNED BY "public"."page_views"."id";



CREATE TABLE IF NOT EXISTS "public"."record_applications" (
    "id" bigint NOT NULL,
    "app_type" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "birth_date" "text",
    "postal_address" "text" NOT NULL,
    "telephone" "text",
    "cell_phone" "text",
    "email" "text" NOT NULL,
    "common_name" "text" NOT NULL,
    "scientific_name" "text",
    "weight_kg" numeric NOT NULL,
    "length_cm" numeric,
    "girth_cm" numeric,
    "height_cm" numeric,
    "date_speared" "text" NOT NULL,
    "location" "text" NOT NULL,
    "hunt_description" "text",
    "scales_location" "text",
    "scales_manufacturer" "text",
    "scales_certified_date" "text",
    "weighmaster_name" "text",
    "weighmaster_address" "text",
    "weighmaster_phone" "text",
    "weighmaster_email" "text",
    "weighmaster_signed" boolean DEFAULT false,
    "witness_name" "text",
    "witness_address" "text",
    "witness_phone" "text",
    "witness_email" "text",
    "declaration_agreed" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'submitted'::"text",
    "admin_notes" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "photo_applicant_with_fish" "text",
    "photo_applicant_on_scales" "text",
    "photo_fish_on_scales" "text",
    "photo_species_diagnostic" "text",
    "photo_length_under" "text",
    "photo_height" "text",
    "photo_length_over" "text",
    "photo_girth" "text",
    "photo_scales_sticker" "text",
    "weighmaster_weight_kg" numeric,
    "witness_signed" boolean DEFAULT false
);


ALTER TABLE "public"."record_applications" OWNER TO "postgres";


ALTER TABLE "public"."record_applications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."record_applications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."registration_counts" AS
 SELECT "count"(*) AS "total_teams",
    "count"(*) FILTER (WHERE ("registered" = true)) AS "checked_in",
    "count"(*) FILTER (WHERE (("registered" = false) AND ("competitor2_name" IS NOT NULL) AND ("competitor2_name" <> ''::"text"))) AS "not_yet_arrived",
    "count"(*) FILTER (WHERE (("competitor2_name" IS NULL) OR ("competitor2_name" = ''::"text"))) AS "incomplete",
    "count"(*) FILTER (WHERE ("is_women" = true)) AS "women_teams",
    "count"(*) FILTER (WHERE ("is_junior" = true)) AS "junior_teams"
   FROM "public"."teams";


ALTER VIEW "public"."registration_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."snz_awards" (
    "id" bigint NOT NULL,
    "year" integer NOT NULL,
    "category" "text" NOT NULL,
    "winner_name" "text" NOT NULL,
    "club" "text",
    "species" "text",
    "weight_kg" numeric,
    "location" "text",
    "description" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."snz_awards" OWNER TO "postgres";


ALTER TABLE "public"."snz_awards" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."snz_awards_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."snz_carousel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photo_url" "text" NOT NULL,
    "thumb_url" "text",
    "caption" "text" DEFAULT ''::"text" NOT NULL,
    "link_url" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snz_carousel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."snz_news" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "category" "text" DEFAULT 'news'::"text",
    "author" "text" DEFAULT 'SNZ Committee'::"text",
    "photo_url" "text",
    "published" boolean DEFAULT true,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."snz_news" OWNER TO "postgres";


ALTER TABLE "public"."snz_news" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."snz_news_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."snz_recipe_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snz_recipe_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."snz_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "display_name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "recipe_url" "text",
    "photo_url" "text",
    "thumb_url" "text",
    "is_approved" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."snz_recipes" OWNER TO "postgres";


ALTER TABLE ONLY "public"."member_whitelist" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."member_whitelist_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."near_miss_rate_limit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."near_miss_rate_limit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."page_views" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."page_views_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."agm_attendees"
    ADD CONSTRAINT "agm_attendees_meeting_id_member_id_key" UNIQUE ("meeting_id", "member_id");



ALTER TABLE ONLY "public"."agm_attendees"
    ADD CONSTRAINT "agm_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agm_meetings"
    ADD CONSTRAINT "agm_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agm_motions"
    ADD CONSTRAINT "agm_motions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agm_votes"
    ADD CONSTRAINT "agm_votes_motion_id_member_id_key" UNIQUE ("motion_id", "member_id");



ALTER TABLE ONLY "public"."agm_votes"
    ADD CONSTRAINT "agm_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bigfish_comps"
    ADD CONSTRAINT "bigfish_comps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bigfish_entries"
    ADD CONSTRAINT "bigfish_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bigfish_registrations"
    ADD CONSTRAINT "bigfish_registrations_comp_id_user_id_key" UNIQUE ("comp_id", "user_id");



ALTER TABLE ONLY "public"."bigfish_registrations"
    ADD CONSTRAINT "bigfish_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bigfish_sponsor_inquiries"
    ADD CONSTRAINT "bigfish_sponsor_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_bonuses"
    ADD CONSTRAINT "bingo_bonuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_bonuses"
    ADD CONSTRAINT "bingo_bonuses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bingo_claims"
    ADD CONSTRAINT "bingo_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_claims"
    ADD CONSTRAINT "bingo_claims_user_id_species_slug_comp_season_key" UNIQUE ("user_id", "species_slug", "comp_season");



ALTER TABLE ONLY "public"."bingo_comp_config"
    ADD CONSTRAINT "bingo_comp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_comp_config"
    ADD CONSTRAINT "bingo_comp_config_season_key" UNIQUE ("season");



ALTER TABLE ONLY "public"."bingo_dishes"
    ADD CONSTRAINT "bingo_dishes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_species"
    ADD CONSTRAINT "bingo_species_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bingo_species"
    ADD CONSTRAINT "bingo_species_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_member_id_key" UNIQUE ("member_id");



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catches"
    ADD CONSTRAINT "catches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_boats"
    ADD CONSTRAINT "comp_boats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_fish"
    ADD CONSTRAINT "comp_fish_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_species_library"
    ADD CONSTRAINT "comp_species_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_species_library"
    ADD CONSTRAINT "comp_species_library_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."comp_team_members"
    ADD CONSTRAINT "comp_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comp_weighins"
    ADD CONSTRAINT "comp_weighins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitions"
    ADD CONSTRAINT "competitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."copilot_events"
    ADD CONSTRAINT "copilot_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_state"
    ADD CONSTRAINT "event_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fish_species"
    ADD CONSTRAINT "fish_species_common_name_key" UNIQUE ("common_name");



ALTER TABLE ONLY "public"."fish_species_photos"
    ADD CONSTRAINT "fish_species_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fish_species"
    ADD CONSTRAINT "fish_species_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_competitions"
    ADD CONSTRAINT "member_competitions_member_id_competition_id_key" UNIQUE ("member_id", "competition_id");



ALTER TABLE ONLY "public"."member_competitions"
    ADD CONSTRAINT "member_competitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."member_whitelist"
    ADD CONSTRAINT "member_whitelist_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."member_whitelist"
    ADD CONSTRAINT "member_whitelist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_member_number_key" UNIQUE ("member_number");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."near_miss_rate_limit"
    ADD CONSTRAINT "near_miss_rate_limit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."near_miss_reports"
    ADD CONSTRAINT "near_miss_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."nz_records"
    ADD CONSTRAINT "nz_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."record_applications"
    ADD CONSTRAINT "record_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snz_awards"
    ADD CONSTRAINT "snz_awards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snz_carousel"
    ADD CONSTRAINT "snz_carousel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snz_news"
    ADD CONSTRAINT "snz_news_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snz_recipe_comments"
    ADD CONSTRAINT "snz_recipe_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."snz_recipes"
    ADD CONSTRAINT "snz_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_team_number_key" UNIQUE ("team_number");



CREATE INDEX "agm_attendees_meeting" ON "public"."agm_attendees" USING "btree" ("meeting_id");



CREATE INDEX "agm_motions_meeting_order" ON "public"."agm_motions" USING "btree" ("meeting_id", "order_no");



CREATE INDEX "agm_votes_member" ON "public"."agm_votes" USING "btree" ("member_id");



CREATE INDEX "agm_votes_motion" ON "public"."agm_votes" USING "btree" ("motion_id");



CREATE INDEX "bigfish_entries_comp_species" ON "public"."bigfish_entries" USING "btree" ("comp_id", "species", "weight_kg" DESC);



CREATE INDEX "bigfish_entries_user" ON "public"."bigfish_entries" USING "btree" ("user_id", "comp_id");



CREATE INDEX "bingo_bonuses_active_type" ON "public"."bingo_bonuses" USING "btree" ("is_active", "bonus_type");



CREATE INDEX "bingo_claims_season" ON "public"."bingo_claims" USING "btree" ("comp_season");



CREATE INDEX "bingo_claims_species" ON "public"."bingo_claims" USING "btree" ("species_slug");



CREATE INDEX "bingo_claims_user_season" ON "public"."bingo_claims" USING "btree" ("user_id", "comp_season");



CREATE INDEX "bingo_dishes_user_season" ON "public"."bingo_dishes" USING "btree" ("user_id", "comp_season");



CREATE INDEX "bingo_species_active" ON "public"."bingo_species" USING "btree" ("is_active", "display_order");



CREATE UNIQUE INDEX "comp_teams_one_per_diver1_per_comp" ON "public"."comp_teams" USING "btree" ("competition_id", "diver1_member_id") WHERE (("withdrawn_at" IS NULL) AND ("diver1_member_id" IS NOT NULL));



CREATE INDEX "idx_catches_catfish_count" ON "public"."catches" USING "btree" ("catfish_count" DESC);



CREATE INDEX "idx_catches_created_at" ON "public"."catches" USING "btree" ("created_at");



CREATE INDEX "idx_catches_status" ON "public"."catches" USING "btree" ("status");



CREATE INDEX "idx_catches_team_id" ON "public"."catches" USING "btree" ("team_id");



CREATE INDEX "idx_fish_species_common_name_lower" ON "public"."fish_species" USING "btree" ("lower"("common_name"));



CREATE INDEX "idx_fish_species_photos_hero" ON "public"."fish_species_photos" USING "btree" ("species_id", "is_hero") WHERE ("is_hero" = true);



CREATE INDEX "idx_fish_species_photos_species" ON "public"."fish_species_photos" USING "btree" ("species_id");



CREATE INDEX "idx_teams_division" ON "public"."teams" USING "btree" ("division");



CREATE INDEX "idx_teams_team_number" ON "public"."teams" USING "btree" ("team_number");



CREATE INDEX "near_miss_rate_limit_ip_time_idx" ON "public"."near_miss_rate_limit" USING "btree" ("ip", "submitted_at");



CREATE INDEX "near_miss_reports_created_idx" ON "public"."near_miss_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "near_miss_reports_location_idx" ON "public"."near_miss_reports" USING "btree" ("lower"("location_name"));



CREATE INDEX "near_miss_reports_region_idx" ON "public"."near_miss_reports" USING "btree" ("region");



CREATE INDEX "near_miss_reports_status_idx" ON "public"."near_miss_reports" USING "btree" ("status");



CREATE INDEX "page_views_created_idx" ON "public"."page_views" USING "btree" ("created_at" DESC);



CREATE INDEX "page_views_member_idx" ON "public"."page_views" USING "btree" ("member_id");



CREATE INDEX "page_views_path_idx" ON "public"."page_views" USING "btree" ("path");



CREATE INDEX "snz_carousel_active_order" ON "public"."snz_carousel" USING "btree" ("is_active", "display_order");



CREATE INDEX "snz_recipe_comments_rid" ON "public"."snz_recipe_comments" USING "btree" ("recipe_id", "created_at");



CREATE INDEX "snz_recipes_approved" ON "public"."snz_recipes" USING "btree" ("is_approved", "created_at" DESC);



CREATE INDEX "snz_recipes_species" ON "public"."snz_recipes" USING "btree" ("species");



CREATE OR REPLACE TRIGGER "agm_meetings_updated_at" BEFORE UPDATE ON "public"."agm_meetings" FOR EACH ROW EXECUTE FUNCTION "public"."agm_set_updated_at"();



CREATE OR REPLACE TRIGGER "agm_motions_updated_at" BEFORE UPDATE ON "public"."agm_motions" FOR EACH ROW EXECUTE FUNCTION "public"."agm_set_updated_at"();



CREATE OR REPLACE TRIGGER "bigfish_entries_updated_at" BEFORE UPDATE ON "public"."bigfish_entries" FOR EACH ROW EXECUTE FUNCTION "public"."bigfish_set_updated_at"();



CREATE OR REPLACE TRIGGER "bingo_bonuses_updated_at" BEFORE UPDATE ON "public"."bingo_bonuses" FOR EACH ROW EXECUTE FUNCTION "public"."bingo_set_updated_at"();



CREATE OR REPLACE TRIGGER "bingo_species_updated_at" BEFORE UPDATE ON "public"."bingo_species" FOR EACH ROW EXECUTE FUNCTION "public"."bingo_set_updated_at"();



CREATE OR REPLACE TRIGGER "fish_species_updated_at" BEFORE UPDATE ON "public"."fish_species" FOR EACH ROW EXECUTE FUNCTION "public"."update_fish_species_timestamp"();



CREATE OR REPLACE TRIGGER "set_member_number" BEFORE INSERT ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."generate_member_number"();



CREATE OR REPLACE TRIGGER "update_catches_updated_at" BEFORE UPDATE ON "public"."catches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_state_updated_at" BEFORE UPDATE ON "public"."event_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agm_attendees"
    ADD CONSTRAINT "agm_attendees_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agm_attendees"
    ADD CONSTRAINT "agm_attendees_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."agm_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agm_attendees"
    ADD CONSTRAINT "agm_attendees_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agm_meetings"
    ADD CONSTRAINT "agm_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agm_motions"
    ADD CONSTRAINT "agm_motions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."agm_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agm_votes"
    ADD CONSTRAINT "agm_votes_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."agm_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agm_votes"
    ADD CONSTRAINT "agm_votes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agm_votes"
    ADD CONSTRAINT "agm_votes_motion_id_fkey" FOREIGN KEY ("motion_id") REFERENCES "public"."agm_motions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bigfish_entries"
    ADD CONSTRAINT "bigfish_entries_comp_id_fkey" FOREIGN KEY ("comp_id") REFERENCES "public"."bigfish_comps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bigfish_entries"
    ADD CONSTRAINT "bigfish_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bigfish_registrations"
    ADD CONSTRAINT "bigfish_registrations_comp_id_fkey" FOREIGN KEY ("comp_id") REFERENCES "public"."bigfish_comps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bigfish_registrations"
    ADD CONSTRAINT "bigfish_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_claims"
    ADD CONSTRAINT "bingo_claims_species_slug_fkey" FOREIGN KEY ("species_slug") REFERENCES "public"."bingo_species"("slug");



ALTER TABLE ONLY "public"."bingo_claims"
    ADD CONSTRAINT "bingo_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bingo_dishes"
    ADD CONSTRAINT "bingo_dishes_species_slug_fkey" FOREIGN KEY ("species_slug") REFERENCES "public"."bingo_species"("slug");



ALTER TABLE ONLY "public"."bingo_dishes"
    ADD CONSTRAINT "bingo_dishes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buddy_requests"
    ADD CONSTRAINT "buddy_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catches"
    ADD CONSTRAINT "catches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_boats"
    ADD CONSTRAINT "comp_boats_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_fish"
    ADD CONSTRAINT "comp_fish_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_team_members"
    ADD CONSTRAINT "comp_team_members_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_team_members"
    ADD CONSTRAINT "comp_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."comp_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_boat_id_fkey" FOREIGN KEY ("boat_id") REFERENCES "public"."comp_boats"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_diver1_member_id_fkey" FOREIGN KEY ("diver1_member_id") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_diver2_member_id_fkey" FOREIGN KEY ("diver2_member_id") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."comp_teams"
    ADD CONSTRAINT "comp_teams_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."comp_weighins"
    ADD CONSTRAINT "comp_weighins_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_weighins"
    ADD CONSTRAINT "comp_weighins_fish_id_fkey" FOREIGN KEY ("fish_id") REFERENCES "public"."comp_fish"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comp_weighins"
    ADD CONSTRAINT "comp_weighins_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."comp_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fish_species_photos"
    ADD CONSTRAINT "fish_species_photos_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "public"."fish_species"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_competitions"
    ADD CONSTRAINT "member_competitions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_competitions"
    ADD CONSTRAINT "member_competitions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."member_competitions"
    ADD CONSTRAINT "member_competitions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."comp_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."near_miss_reports"
    ADD CONSTRAINT "near_miss_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."page_views"
    ADD CONSTRAINT "page_views_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."snz_recipe_comments"
    ADD CONSTRAINT "snz_recipe_comments_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."snz_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."snz_recipe_comments"
    ADD CONSTRAINT "snz_recipe_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."snz_recipes"
    ADD CONSTRAINT "snz_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Allow anonymous inserts" ON "public"."page_views" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow delete record_applications" ON "public"."record_applications" FOR DELETE USING (true);



CREATE POLICY "Allow update record_applications" ON "public"."record_applications" FOR UPDATE USING (true);



CREATE POLICY "Anyone can read comp_fish" ON "public"."comp_fish" FOR SELECT USING (true);



CREATE POLICY "Anyone can read comp_team_members" ON "public"."comp_team_members" FOR SELECT USING (true);



CREATE POLICY "Anyone can read comp_teams" ON "public"."comp_teams" FOR SELECT USING (true);



CREATE POLICY "Anyone can read comp_weighins" ON "public"."comp_weighins" FOR SELECT USING (true);



CREATE POLICY "Anyone can read competitions" ON "public"."competitions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read member_competitions" ON "public"."member_competitions" FOR SELECT USING (true);



CREATE POLICY "Anyone can read species library" ON "public"."comp_species_library" FOR SELECT USING (true);



CREATE POLICY "Anyone can read whitelist" ON "public"."member_whitelist" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can register a team" ON "public"."comp_teams" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can register members" ON "public"."comp_team_members" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can submit a near-miss report" ON "public"."near_miss_reports" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Anyone can submit record applications" ON "public"."record_applications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated can manage comp_fish" ON "public"."comp_fish" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage comp_team_members" ON "public"."comp_team_members" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage comp_teams" ON "public"."comp_teams" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage comp_weighins" ON "public"."comp_weighins" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage competitions" ON "public"."competitions" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage member_competitions" ON "public"."member_competitions" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage snz_awards" ON "public"."snz_awards" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage snz_news" ON "public"."snz_news" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can manage species library" ON "public"."comp_species_library" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated can read" ON "public"."page_views" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can read all members" ON "public"."members" FOR SELECT USING (true);



CREATE POLICY "Authenticated can read members" ON "public"."members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated can read record applications" ON "public"."record_applications" FOR SELECT USING (true);



CREATE POLICY "Authenticated can update record applications" ON "public"."record_applications" FOR UPDATE USING (true);



CREATE POLICY "Authenticated users can manage nz_records" ON "public"."nz_records" USING (true) WITH CHECK (true);



CREATE POLICY "Members can insert own profile" ON "public"."members" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Members can update own profile" ON "public"."members" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Members can view own profile" ON "public"."members" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Public can read catches" ON "public"."catches" FOR SELECT USING (true);



CREATE POLICY "Public can read event_state" ON "public"."event_state" FOR SELECT USING (true);



CREATE POLICY "Public can read members" ON "public"."members" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Public can read nz_records" ON "public"."nz_records" FOR SELECT USING (true);



CREATE POLICY "Public can read published snz_news" ON "public"."snz_news" FOR SELECT USING (("published" = true));



CREATE POLICY "Public can read snz_awards" ON "public"."snz_awards" FOR SELECT USING (true);



CREATE POLICY "Public can read teams" ON "public"."teams" FOR SELECT USING (true);



CREATE POLICY "Public read fish species" ON "public"."fish_species" FOR SELECT USING (true);



CREATE POLICY "Public read fish species photos" ON "public"."fish_species_photos" FOR SELECT USING (true);



CREATE POLICY "Submitters can read their own reports" ON "public"."near_miss_reports" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."agm_attendees" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agm_attendees_read" ON "public"."agm_attendees" FOR SELECT USING (true);



CREATE POLICY "agm_attendees_self_delete" ON "public"."agm_attendees" FOR DELETE USING (("auth"."uid"() = "member_id"));



CREATE POLICY "agm_attendees_self_insert" ON "public"."agm_attendees" FOR INSERT WITH CHECK (("auth"."uid"() = "member_id"));



ALTER TABLE "public"."agm_meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agm_meetings_read" ON "public"."agm_meetings" FOR SELECT USING (("status" <> 'draft'::"text"));



ALTER TABLE "public"."agm_motions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agm_motions_read" ON "public"."agm_motions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."agm_meetings" "m"
  WHERE (("m"."id" = "agm_motions"."meeting_id") AND ("m"."status" <> 'draft'::"text")))));



ALTER TABLE "public"."agm_votes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agm_votes_read" ON "public"."agm_votes" FOR SELECT USING (true);



CREATE POLICY "agm_votes_self_insert" ON "public"."agm_votes" FOR INSERT WITH CHECK (("auth"."uid"() = "member_id"));



CREATE POLICY "agm_votes_self_update" ON "public"."agm_votes" FOR UPDATE USING (("auth"."uid"() = "member_id"));



CREATE POLICY "agmattendeesadmin" ON "public"."agm_attendees" FOR INSERT WITH CHECK (true);



CREATE POLICY "agmmeetingswrite" ON "public"."agm_meetings" USING (true) WITH CHECK (true);



CREATE POLICY "agmmotionswrite" ON "public"."agm_motions" USING (true) WITH CHECK (true);



CREATE POLICY "allow_insert_page_views" ON "public"."page_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_read_copilot_events" ON "public"."copilot_events" FOR SELECT USING (true);



CREATE POLICY "allow_read_page_views" ON "public"."page_views" FOR SELECT USING (true);



ALTER TABLE "public"."bigfish_comps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bigfish_comps_all_write" ON "public"."bigfish_comps" USING (true) WITH CHECK (true);



CREATE POLICY "bigfish_comps_public_read" ON "public"."bigfish_comps" FOR SELECT USING (true);



ALTER TABLE "public"."bigfish_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bigfish_entries_admin_all" ON "public"."bigfish_entries" USING (true) WITH CHECK (true);



CREATE POLICY "bigfish_entries_delete" ON "public"."bigfish_entries" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bigfish_entries_insert" ON "public"."bigfish_entries" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bigfish_entries_public_read" ON "public"."bigfish_entries" FOR SELECT USING (true);



CREATE POLICY "bigfish_entries_update" ON "public"."bigfish_entries" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."bigfish_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bigfish_regs_delete" ON "public"."bigfish_registrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bigfish_regs_insert" ON "public"."bigfish_registrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bigfish_regs_public_read" ON "public"."bigfish_registrations" FOR SELECT USING (true);



ALTER TABLE "public"."bigfish_sponsor_inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bingo_bonuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bingo_bonuses_public_read" ON "public"."bingo_bonuses" FOR SELECT USING (true);



CREATE POLICY "bingo_bonuses_service_write" ON "public"."bingo_bonuses" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."bingo_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bingo_claims_delete" ON "public"."bingo_claims" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bingo_claims_insert" ON "public"."bingo_claims" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bingo_claims_read" ON "public"."bingo_claims" FOR SELECT USING (true);



ALTER TABLE "public"."bingo_comp_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bingo_comp_config_public_read" ON "public"."bingo_comp_config" FOR SELECT USING (true);



CREATE POLICY "bingo_comp_config_service_write" ON "public"."bingo_comp_config" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."bingo_dishes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bingo_dishes_delete" ON "public"."bingo_dishes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "bingo_dishes_insert" ON "public"."bingo_dishes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "bingo_dishes_read" ON "public"."bingo_dishes" FOR SELECT USING (true);



ALTER TABLE "public"."bingo_species" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bingo_species_public_read" ON "public"."bingo_species" FOR SELECT USING (true);



CREATE POLICY "bingo_species_service_write" ON "public"."bingo_species" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."comp_boats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "comp_boats_all_write" ON "public"."comp_boats" USING (true) WITH CHECK (true);



CREATE POLICY "comp_boats_public_read" ON "public"."comp_boats" FOR SELECT USING (true);



ALTER TABLE "public"."comp_fish" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comp_species_library" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comp_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comp_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comp_weighins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."competitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."copilot_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fish_species" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fish_species_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_competitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."member_whitelist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."near_miss_rate_limit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."near_miss_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."nz_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."page_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."record_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snz_awards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snz_carousel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snz_carousel_admin_write" ON "public"."snz_carousel" USING (true) WITH CHECK (true);



CREATE POLICY "snz_carousel_public_read" ON "public"."snz_carousel" FOR SELECT USING (true);



CREATE POLICY "snz_carousel_service_all" ON "public"."snz_carousel" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."snz_news" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."snz_recipe_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snz_recipe_comments_auth_insert" ON "public"."snz_recipe_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "snz_recipe_comments_own_delete" ON "public"."snz_recipe_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "snz_recipe_comments_public_read" ON "public"."snz_recipe_comments" FOR SELECT USING (true);



CREATE POLICY "snz_recipe_comments_service_all" ON "public"."snz_recipe_comments" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."snz_recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "snz_recipes_auth_insert" ON "public"."snz_recipes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "snz_recipes_own_delete" ON "public"."snz_recipes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "snz_recipes_public_read" ON "public"."snz_recipes" FOR SELECT USING (("is_approved" = true));



CREATE POLICY "snz_recipes_service_all" ON "public"."snz_recipes" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "sponsor_inquiries_insert" ON "public"."bigfish_sponsor_inquiries" FOR INSERT WITH CHECK (true);



CREATE POLICY "sponsor_inquiries_read" ON "public"."bigfish_sponsor_inquiries" FOR SELECT USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."agm_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."agm_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."agm_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bigfish_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."bigfish_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bigfish_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bingo_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."bingo_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bingo_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_member_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_member_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_member_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_heaviest_fish_leader"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_heaviest_fish_leader"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_heaviest_fish_leader"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_lightest_fish_leader"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_lightest_fish_leader"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lightest_fish_leader"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_fish_species_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fish_species_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fish_species_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."agm_attendees" TO "anon";
GRANT ALL ON TABLE "public"."agm_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."agm_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."agm_meetings" TO "anon";
GRANT ALL ON TABLE "public"."agm_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."agm_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."agm_motions" TO "anon";
GRANT ALL ON TABLE "public"."agm_motions" TO "authenticated";
GRANT ALL ON TABLE "public"."agm_motions" TO "service_role";



GRANT ALL ON TABLE "public"."agm_votes" TO "anon";
GRANT ALL ON TABLE "public"."agm_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."agm_votes" TO "service_role";



GRANT ALL ON TABLE "public"."bigfish_comps" TO "anon";
GRANT ALL ON TABLE "public"."bigfish_comps" TO "authenticated";
GRANT ALL ON TABLE "public"."bigfish_comps" TO "service_role";



GRANT ALL ON TABLE "public"."bigfish_entries" TO "anon";
GRANT ALL ON TABLE "public"."bigfish_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."bigfish_entries" TO "service_role";



GRANT ALL ON TABLE "public"."bigfish_registrations" TO "anon";
GRANT ALL ON TABLE "public"."bigfish_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."bigfish_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."bigfish_sponsor_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."bigfish_sponsor_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."bigfish_sponsor_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_bonuses" TO "anon";
GRANT ALL ON TABLE "public"."bingo_bonuses" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_bonuses" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_claims" TO "anon";
GRANT ALL ON TABLE "public"."bingo_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_claims" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_comp_config" TO "anon";
GRANT ALL ON TABLE "public"."bingo_comp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_comp_config" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_dishes" TO "anon";
GRANT ALL ON TABLE "public"."bingo_dishes" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_dishes" TO "service_role";



GRANT ALL ON TABLE "public"."bingo_species" TO "anon";
GRANT ALL ON TABLE "public"."bingo_species" TO "authenticated";
GRANT ALL ON TABLE "public"."bingo_species" TO "service_role";



GRANT ALL ON TABLE "public"."buddy_requests" TO "anon";
GRANT ALL ON TABLE "public"."buddy_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."buddy_requests" TO "service_role";



GRANT ALL ON TABLE "public"."catches" TO "anon";
GRANT ALL ON TABLE "public"."catches" TO "authenticated";
GRANT ALL ON TABLE "public"."catches" TO "service_role";



GRANT ALL ON TABLE "public"."comp_boats" TO "anon";
GRANT ALL ON TABLE "public"."comp_boats" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_boats" TO "service_role";



GRANT ALL ON TABLE "public"."comp_fish" TO "anon";
GRANT ALL ON TABLE "public"."comp_fish" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_fish" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comp_fish_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comp_fish_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comp_fish_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comp_species_library" TO "anon";
GRANT ALL ON TABLE "public"."comp_species_library" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_species_library" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comp_species_library_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comp_species_library_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comp_species_library_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comp_team_members" TO "anon";
GRANT ALL ON TABLE "public"."comp_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_team_members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comp_team_members_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comp_team_members_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comp_team_members_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comp_teams" TO "anon";
GRANT ALL ON TABLE "public"."comp_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_teams" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comp_teams_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comp_teams_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comp_teams_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."comp_weighins" TO "anon";
GRANT ALL ON TABLE "public"."comp_weighins" TO "authenticated";
GRANT ALL ON TABLE "public"."comp_weighins" TO "service_role";



GRANT ALL ON SEQUENCE "public"."comp_weighins_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."comp_weighins_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."comp_weighins_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."competitions" TO "anon";
GRANT ALL ON TABLE "public"."competitions" TO "authenticated";
GRANT ALL ON TABLE "public"."competitions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."competitions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."competitions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."competitions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."copilot_events" TO "anon";
GRANT ALL ON TABLE "public"."copilot_events" TO "authenticated";
GRANT ALL ON TABLE "public"."copilot_events" TO "service_role";



GRANT ALL ON TABLE "public"."event_state" TO "anon";
GRANT ALL ON TABLE "public"."event_state" TO "authenticated";
GRANT ALL ON TABLE "public"."event_state" TO "service_role";



GRANT ALL ON TABLE "public"."fish_species" TO "anon";
GRANT ALL ON TABLE "public"."fish_species" TO "authenticated";
GRANT ALL ON TABLE "public"."fish_species" TO "service_role";



GRANT ALL ON TABLE "public"."fish_species_photos" TO "anon";
GRANT ALL ON TABLE "public"."fish_species_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."fish_species_photos" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard" TO "service_role";



GRANT ALL ON TABLE "public"."leaderboard_counts" TO "anon";
GRANT ALL ON TABLE "public"."leaderboard_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."leaderboard_counts" TO "service_role";



GRANT ALL ON TABLE "public"."member_competitions" TO "anon";
GRANT ALL ON TABLE "public"."member_competitions" TO "authenticated";
GRANT ALL ON TABLE "public"."member_competitions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."member_competitions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."member_competitions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."member_competitions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."member_whitelist" TO "anon";
GRANT ALL ON TABLE "public"."member_whitelist" TO "authenticated";
GRANT ALL ON TABLE "public"."member_whitelist" TO "service_role";



GRANT ALL ON SEQUENCE "public"."member_whitelist_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."member_whitelist_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."member_whitelist_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON TABLE "public"."near_miss_rate_limit" TO "anon";
GRANT ALL ON TABLE "public"."near_miss_rate_limit" TO "authenticated";
GRANT ALL ON TABLE "public"."near_miss_rate_limit" TO "service_role";



GRANT ALL ON SEQUENCE "public"."near_miss_rate_limit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."near_miss_rate_limit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."near_miss_rate_limit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."near_miss_reports" TO "anon";
GRANT ALL ON TABLE "public"."near_miss_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."near_miss_reports" TO "service_role";



GRANT ALL ON TABLE "public"."nz_records" TO "anon";
GRANT ALL ON TABLE "public"."nz_records" TO "authenticated";
GRANT ALL ON TABLE "public"."nz_records" TO "service_role";



GRANT ALL ON SEQUENCE "public"."nz_records_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."nz_records_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."nz_records_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."page_views" TO "anon";
GRANT ALL ON TABLE "public"."page_views" TO "authenticated";
GRANT ALL ON TABLE "public"."page_views" TO "service_role";



GRANT ALL ON SEQUENCE "public"."page_views_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."page_views_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."page_views_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."record_applications" TO "anon";
GRANT ALL ON TABLE "public"."record_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."record_applications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."record_applications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."record_applications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."record_applications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."registration_counts" TO "anon";
GRANT ALL ON TABLE "public"."registration_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_counts" TO "service_role";



GRANT ALL ON TABLE "public"."snz_awards" TO "anon";
GRANT ALL ON TABLE "public"."snz_awards" TO "authenticated";
GRANT ALL ON TABLE "public"."snz_awards" TO "service_role";



GRANT ALL ON SEQUENCE "public"."snz_awards_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snz_awards_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snz_awards_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."snz_carousel" TO "anon";
GRANT ALL ON TABLE "public"."snz_carousel" TO "authenticated";
GRANT ALL ON TABLE "public"."snz_carousel" TO "service_role";



GRANT ALL ON TABLE "public"."snz_news" TO "anon";
GRANT ALL ON TABLE "public"."snz_news" TO "authenticated";
GRANT ALL ON TABLE "public"."snz_news" TO "service_role";



GRANT ALL ON SEQUENCE "public"."snz_news_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."snz_news_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."snz_news_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."snz_recipe_comments" TO "anon";
GRANT ALL ON TABLE "public"."snz_recipe_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."snz_recipe_comments" TO "service_role";



GRANT ALL ON TABLE "public"."snz_recipes" TO "anon";
GRANT ALL ON TABLE "public"."snz_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."snz_recipes" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







