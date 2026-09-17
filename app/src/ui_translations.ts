import { GENERATED_EN_UI } from './i18n/en.generated'
import { COMPLETED_EN_UI } from './i18n/en.complete.reviewed'
import { REVIEWED_EN_INTERFACE_GAPS } from './i18n/en.interface_gaps.reviewed'
import { REVIEWED_HOME_STATISTICS_ALL_UI, translateStatisticsSnapshot } from './i18n/home_statistics_all.reviewed'
import { REVIEWED_SHARED_CONTROLS_ALL_UI } from './i18n/shared_controls_all.reviewed'
import { REVIEWED_AUTHOR_FORM_ALL_UI } from './i18n/author_form_all.reviewed'
import { REVIEWED_BOOK_SORT_ALL_UI } from './i18n/book_sort_all.reviewed'
import { addAuthorInlineTranslations } from './i18n/author_inline_all.reviewed'
import { REVIEWED_SIGN_IN_ALL_UI } from './i18n/sign_in_all.reviewed'
import { REVIEWED_ACCOUNT_CURRENT_ALL_UI } from './i18n/account_current_all.reviewed'
import { REVIEWED_WELCOME_CURRENT_ALL_UI } from './i18n/welcome_current_all.reviewed'
import { REVIEWED_PWA_INSTALL_ALL_UI } from './i18n/pwa_install_all.reviewed'
import { REVIEWED_QUOTES_CURRENT_ALL_UI } from './i18n/quotes_current_all.reviewed'
import { REVIEWED_QUOTES_PUBLIC_ALL_UI } from './i18n/quotes_public_all.reviewed'
import { REVIEWED_SETTINGS_CURRENT_ALL_UI } from './i18n/settings_current_all.reviewed'
import { REVIEWED_SETTINGS_BACKUP_CURRENT_ALL_UI } from './i18n/settings_backup_current_all.reviewed'
import { REVIEWED_FEATURES_CURRENT_ALL_UI, translateFeatureItemCount } from './i18n/features_current_all.reviewed'
import { REVIEWED_SETTINGS_RELEASE_GATE_UI } from './i18n/settings_release_gate.reviewed'
import { REVIEWED_ACCOUNT_DEVICES_ALL_UI } from './i18n/account_devices_all.reviewed'
import { REVIEWED_ACCOUNT_LOGIN_ERRORS_ALL_UI } from './i18n/account_login_errors_all.reviewed'
import { REVIEWED_ACCOUNT_ACCESS_ERRORS_ALL_UI } from './i18n/account_access_errors_all.reviewed'
import { REVIEWED_EN_UI } from './i18n/en.reviewed'
import { ADMIN_INDEXING_EN } from './i18n/admin_indexing.en'
import { GENERATED_FR_UI } from './i18n/fr.generated'
import { REVIEWED_FR_UI } from './i18n/fr.reviewed'
import { REVIEWED_CKB_UI } from './i18n/ckb.reviewed'
import { REVIEWED_KU_UI } from './i18n/ku.reviewed'
import { REVIEWED_TR_UI } from './i18n/tr.reviewed'
import { REVIEWED_UR_UI } from './i18n/ur.reviewed'
import { REVIEWED_FA_UI } from './i18n/fa.reviewed'
import { REVIEWED_ROUTE_UI } from './i18n/routes.reviewed'
import { REVIEWED_INNER_ROUTE_UI } from './i18n/inner_routes.reviewed'
import { REVIEWED_SETTINGS_UI } from './i18n/settings.reviewed'
import { REVIEWED_LIBRARY_INNER_UI } from './i18n/library_inner.reviewed'
import { REVIEWED_MEMORY_UI } from './i18n/memory.reviewed'
import { REVIEWED_WORKFLOW_UI } from './i18n/workflows.reviewed'
import { REVIEWED_DIALOG_UI } from './i18n/dialogs.reviewed'
import { REVIEWED_NOTES_UI } from './i18n/notes.reviewed'
import { REVIEWED_NOTES_DYNAMIC_TEMPLATES } from './i18n/notes_dynamic.reviewed'
import { REVIEWED_SHELVES_UI } from './i18n/shelves.reviewed'
import { REVIEWED_SHELVES_DYNAMIC_TEMPLATES } from './i18n/shelves_dynamic.reviewed'
import { REVIEWED_SETTINGS_BACKUP_UI } from './i18n/settings_backup.reviewed'
import { REVIEWED_SETTINGS_DYNAMIC_TEMPLATES } from './i18n/settings_dynamic.reviewed'
import { REVIEWED_READING_PLANS_UI } from './i18n/reading_plans.reviewed'
import { REVIEWED_READING_PLANS_PROGRESS_UI, REVIEWED_READING_PLAN_PROGRESS_TEMPLATES } from './i18n/reading_plans_progress.reviewed'
import { REVIEWED_READING_PLANS_HEADER_ALL_UI } from './i18n/reading_plans_header_all.reviewed'
import { REVIEWED_READING_PLANS_RECOVERY_ALL_UI } from './i18n/reading_plans_recovery_all.reviewed'
import { REVIEWED_READING_PLANS_COMPLETION_ALL_UI } from './i18n/reading_plans_completion_all.reviewed'
import { REVIEWED_READING_PLANS_GUIDANCE_ALL_UI } from './i18n/reading_plans_guidance_all.reviewed'
import { REVIEWED_RESEARCH_UI } from './i18n/research.reviewed'
import { REVIEWED_RESEARCH_DYNAMIC_TEMPLATES } from './i18n/research_dynamic.reviewed'
import { REVIEWED_ADMIN_QUALITY_UI } from './i18n/admin_quality.reviewed'
import { REVIEWED_ADMIN_QUALITY_CORE_ALL_UI } from './i18n/admin_quality_core_all.reviewed'
import { REVIEWED_ADMIN_QUALITY_FILTERS_ALL_UI } from './i18n/admin_quality_filters_all.reviewed'
import { REVIEWED_ADMIN_QUALITY_STATES_ALL_UI } from './i18n/admin_quality_states_all.reviewed'
import { REVIEWED_ADMIN_SUBMISSIONS_UI } from './i18n/admin_submissions.reviewed'
import { REVIEWED_ADMIN_AUDIT_UI } from './i18n/admin_audit.reviewed'
import { REVIEWED_ADMIN_BOOK_FIELDS_DYNAMIC_TEMPLATES } from './i18n/admin_book_fields_dynamic.reviewed'
import { REVIEWED_ADMIN_STATS_UI } from './i18n/admin_stats.reviewed'
import { REVIEWED_ADMIN_QUALITY_COUNT_TEMPLATES, REVIEWED_ADMIN_QUALITY_OPEN_TEMPLATES } from './i18n/admin_quality_dynamic.reviewed'
import { REVIEWED_DISCOVER_UI } from './i18n/discover.reviewed'
import { REVIEWED_NEW_BOOKS_DYNAMIC_ALL_TEMPLATES } from './i18n/new_books_dynamic_all.reviewed'
import { REVIEWED_NEW_BOOKS_CORE_ALL_UI } from './i18n/new_books_core_all.reviewed'
import { REVIEWED_NEW_BOOKS_STATES_ALL_UI } from './i18n/new_books_states_all.reviewed'
import { REVIEWED_NEW_BOOKS_FAILURES_ALL_UI } from './i18n/new_books_failures_all.reviewed'
import { REVIEWED_EDITIONS_SERIES_UI } from './i18n/editions_series.reviewed'
import { REVIEWED_EDITIONS_INTERNAL_ALL_UI } from './i18n/editions_internal_all.reviewed'
import { REVIEWED_SERIES_ALL_UI } from './i18n/series_all.reviewed'
import { REVIEWED_EDITIONS_SERIES_DYNAMIC_TEMPLATES } from './i18n/editions_series_dynamic.reviewed'
import { REVIEWED_ME_UI } from './i18n/me.reviewed'
import { REVIEWED_BOOK_PAGE_UI } from './i18n/book_page.reviewed'
import { REVIEWED_BOOK_PREVIEW_DYNAMIC_TEMPLATES } from './i18n/book_preview_dynamic.reviewed'
import { REVIEWED_BOOK_READING_PLAN_DYNAMIC_TEMPLATES } from './i18n/book_reading_plan_dynamic.reviewed'
import { REVIEWED_BOOK_METADATA_DYNAMIC_TEMPLATES } from './i18n/book_metadata_dynamic.reviewed'
import { REVIEWED_HOME_DAILY_UI } from './i18n/home_daily.reviewed'
import { REVIEWED_SOURCE_SYNC_UI } from './i18n/source_sync.reviewed'
import { REVIEWED_OFFLINE_UI } from './i18n/offline.reviewed'
import { REVIEWED_APPEARANCE_UI } from './i18n/appearance.reviewed'
import { REVIEWED_WELCOME_UI } from './i18n/welcome.reviewed'
import { REVIEWED_FEATURES_INTRO_UI } from './i18n/features_intro.reviewed'
import { REVIEWED_FEATURES_READER_UI } from './i18n/features_reader.reviewed'
import { REVIEWED_FEATURES_WORKFLOW_UI } from './i18n/features_workflow.reviewed'
import { REVIEWED_FEATURES_ACCESS_UI } from './i18n/features_access.reviewed'
import { REVIEWED_FEATURES_CATALOG_UI } from './i18n/features_catalog.reviewed'
import { REVIEWED_FEATURES_KNOWLEDGE_UI } from './i18n/features_knowledge.reviewed'
import { REVIEWED_FEATURES_VISION_UI } from './i18n/features_vision.reviewed'
import { REVIEWED_FEATURES_AI_UI } from './i18n/features_ai.reviewed'
import { REVIEWED_FEATURES_INDEX_UI } from './i18n/features_index.reviewed'
import { REVIEWED_ACCESSIBILITY_BRAND_UI } from './i18n/accessibility_brand.reviewed'
import { REVIEWED_QURAN_TOOLS_UI } from './i18n/quran_tools.reviewed'
import { REVIEWED_QURAN_MODES_UI } from './i18n/quran_modes.reviewed'
import { REVIEWED_QURAN_AUDIO_UI } from './i18n/quran_audio.reviewed'
import { REVIEWED_QURAN_FEEDBACK_UI } from './i18n/quran_feedback.reviewed'
import { REVIEWED_SUNNAH_SOURCES_UI } from './i18n/sunnah_sources.reviewed'
import { REVIEWED_SUNNAH_CATEGORIES_UI } from './i18n/sunnah_categories.reviewed'
import { REVIEWED_SUNNAH_ROOM_UI } from './i18n/sunnah_room.reviewed'
import { REVIEWED_SUNNAH_SCIENCES_UI } from './i18n/sunnah_sciences.reviewed'
import { REVIEWED_BOOK_IMPORT_CORE_UI } from './i18n/book_import_core.reviewed'
import { REVIEWED_BOOK_IMPORT_METADATA_UI } from './i18n/book_import_metadata.reviewed'
import { REVIEWED_BOOK_IMPORT_BATCH_UI } from './i18n/book_import_batch.reviewed'
import { REVIEWED_BOOK_IMPORT_VALIDATION_UI } from './i18n/book_import_validation.reviewed'
import { REVIEWED_BOOK_IMPORT_FIELDS_UI } from './i18n/book_import_fields.reviewed'
import { REVIEWED_BOOK_IMPORT_OPTIONS_UI } from './i18n/book_import_options.reviewed'
import { REVIEWED_BOOK_IMPORT_GUIDANCE_UI } from './i18n/book_import_guidance.reviewed'
import { REVIEWED_BOOK_IMPORT_CONVERSION_UI } from './i18n/book_import_conversion.reviewed'
import { REVIEWED_LIBRARY_ADMIN_A_UI } from './i18n/library_admin_a.reviewed'
import { REVIEWED_LIBRARY_ADMIN_B_UI } from './i18n/library_admin_b.reviewed'
import { REVIEWED_LIBRARY_ADMIN_C_UI } from './i18n/library_admin_c.reviewed'
import { REVIEWED_LIBRARY_ADMIN_D_UI } from './i18n/library_admin_d.reviewed'
import { REVIEWED_LIBRARY_ADMIN_E_UI } from './i18n/library_admin_e.reviewed'
import { REVIEWED_LIBRARY_ADMIN_F_UI } from './i18n/library_admin_f.reviewed'
import { REVIEWED_LIBRARY_ADMIN_G_UI } from './i18n/library_admin_g.reviewed'
import { REVIEWED_LIBRARY_ADMIN_H_UI } from './i18n/library_admin_h.reviewed'
import { REVIEWED_LIBRARY_ADMIN_I_UI } from './i18n/library_admin_i.reviewed'
import { REVIEWED_LIBRARY_ADMIN_J_UI } from './i18n/library_admin_j.reviewed'
import { REVIEWED_LIBRARY_ADMIN_K_UI } from './i18n/library_admin_k.reviewed'
import { REVIEWED_LIBRARY_ADMIN_L_UI } from './i18n/library_admin_l.reviewed'
import { REVIEWED_LIBRARY_ADMIN_M_UI } from './i18n/library_admin_m.reviewed'
import { REVIEWED_LIBRARY_ADMIN_N_UI } from './i18n/library_admin_n.reviewed'
import { REVIEWED_LIBRARY_ADMIN_O_UI } from './i18n/library_admin_o.reviewed'
import { REVIEWED_LIBRARY_ADMIN_P_UI } from './i18n/library_admin_p.reviewed'
import { REVIEWED_LIBRARY_ADMIN_Q_UI } from './i18n/library_admin_q.reviewed'
import { REVIEWED_LIBRARY_ADMIN_R_UI } from './i18n/library_admin_r.reviewed'
import { REVIEWED_LIBRARY_ADMIN_S_UI } from './i18n/library_admin_s.reviewed'
import { REVIEWED_LIBRARY_ADMIN_T_UI } from './i18n/library_admin_t.reviewed'
import { REVIEWED_LIBRARY_ADMIN_U_UI } from './i18n/library_admin_u.reviewed'
import { REVIEWED_LIBRARY_ADMIN_V_UI } from './i18n/library_admin_v.reviewed'
import { REVIEWED_LIBRARY_ADMIN_W_UI } from './i18n/library_admin_w.reviewed'
import { REVIEWED_LIBRARY_ADMIN_X_UI } from './i18n/library_admin_x.reviewed'
import { REVIEWED_LIBRARY_ADMIN_Y_UI } from './i18n/library_admin_y.reviewed'
import { REVIEWED_LIBRARY_ADMIN_Z_UI } from './i18n/library_admin_z.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AA_UI } from './i18n/library_admin_aa.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AB_UI } from './i18n/library_admin_ab.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AC_UI } from './i18n/library_admin_ac.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AD_UI } from './i18n/library_admin_ad.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AE_UI } from './i18n/library_admin_ae.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AF_UI } from './i18n/library_admin_af.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AG_UI } from './i18n/library_admin_ag.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AH_UI } from './i18n/library_admin_ah.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AI_UI } from './i18n/library_admin_ai.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AJ_UI } from './i18n/library_admin_aj.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AK_UI } from './i18n/library_admin_ak.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AL_UI } from './i18n/library_admin_al.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AM_UI } from './i18n/library_admin_am.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AN_UI } from './i18n/library_admin_an.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AO_UI } from './i18n/library_admin_ao.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AP_UI } from './i18n/library_admin_ap.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AQ_UI } from './i18n/library_admin_aq.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AR_UI } from './i18n/library_admin_ar.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AS_UI } from './i18n/library_admin_as.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AT_UI } from './i18n/library_admin_at.reviewed'
import { REVIEWED_LIBRARY_ADMIN_AU_UI } from './i18n/library_admin_au.reviewed'
import { REVIEWED_TRANSLATION_PANEL_A_UI } from './i18n/translation_panel_a.reviewed'
import { REVIEWED_TRANSLATION_PANEL_B_UI } from './i18n/translation_panel_b.reviewed'
import { REVIEWED_TRANSLATION_PANEL_C_UI } from './i18n/translation_panel_c.reviewed'
import { REVIEWED_TRANSLATION_PANEL_D_UI } from './i18n/translation_panel_d.reviewed'
import { REVIEWED_TRANSLATION_PANEL_E_UI } from './i18n/translation_panel_e.reviewed'
import { REVIEWED_TRANSLATION_PANEL_F_UI } from './i18n/translation_panel_f.reviewed'
import { REVIEWED_TRANSLATION_PANEL_G_UI } from './i18n/translation_panel_g.reviewed'
import { REVIEWED_TRANSLATION_PANEL_H_UI } from './i18n/translation_panel_h.reviewed'
import { REVIEWED_TRANSLATION_PANEL_I_UI } from './i18n/translation_panel_i.reviewed'
import { REVIEWED_TRANSLATION_PANEL_J_UI } from './i18n/translation_panel_j.reviewed'
import { REVIEWED_TRANSLATION_PANEL_K_UI } from './i18n/translation_panel_k.reviewed'
import { REVIEWED_TRANSLATION_PANEL_L_UI } from './i18n/translation_panel_l.reviewed'
import { REVIEWED_TRANSLATION_PANEL_M_UI } from './i18n/translation_panel_m.reviewed'
import { REVIEWED_HOME_INTERNAL_A_UI } from './i18n/home_internal_a.reviewed'
import { REVIEWED_HOME_INTERNAL_B_UI } from './i18n/home_internal_b.reviewed'
import { REVIEWED_HOME_INTERNAL_C_UI } from './i18n/home_internal_c.reviewed'
import { REVIEWED_HOME_INTERNAL_D_UI } from './i18n/home_internal_d.reviewed'
import { REVIEWED_HOME_INTERNAL_E_UI } from './i18n/home_internal_e.reviewed'
import { REVIEWED_HOME_INTERNAL_F_UI } from './i18n/home_internal_f.reviewed'
import { REVIEWED_HOME_INTERNAL_G_UI } from './i18n/home_internal_g.reviewed'
import { REVIEWED_HOME_INTERNAL_H_UI } from './i18n/home_internal_h.reviewed'
import { REVIEWED_HOME_INTERNAL_I_UI } from './i18n/home_internal_i.reviewed'
import { REVIEWED_HOME_INTERNAL_J_UI } from './i18n/home_internal_j.reviewed'
import { REVIEWED_ME_INTERNAL_A_UI } from './i18n/me_internal_a.reviewed'
import { REVIEWED_ME_INTERNAL_B_UI } from './i18n/me_internal_b.reviewed'
import { REVIEWED_ME_INTERNAL_C_UI } from './i18n/me_internal_c.reviewed'
import { REVIEWED_ME_INTERNAL_D_UI } from './i18n/me_internal_d.reviewed'
import { REVIEWED_ME_INTERNAL_E_UI } from './i18n/me_internal_e.reviewed'
import { REVIEWED_ME_INTERNAL_F_UI } from './i18n/me_internal_f.reviewed'
import { REVIEWED_ME_INTERNAL_G_UI } from './i18n/me_internal_g.reviewed'
import { REVIEWED_ME_INTERNAL_H_UI } from './i18n/me_internal_h.reviewed'
import { REVIEWED_BOOK_INTERNAL_A_UI } from './i18n/book_internal_a.reviewed'
import { REVIEWED_BOOK_INTERNAL_B_UI } from './i18n/book_internal_b.reviewed'
import { REVIEWED_BOOK_INTERNAL_C_UI } from './i18n/book_internal_c.reviewed'
import { REVIEWED_BOOK_INTERNAL_D_UI } from './i18n/book_internal_d.reviewed'
import { REVIEWED_BOOK_INTERNAL_E_UI } from './i18n/book_internal_e.reviewed'
import { REVIEWED_BOOK_INTERNAL_F_UI } from './i18n/book_internal_f.reviewed'
import { REVIEWED_BOOK_INTERNAL_G_UI } from './i18n/book_internal_g.reviewed'
import { REVIEWED_NOTES_INTERNAL_A_UI } from './i18n/notes_internal_a.reviewed'
import { REVIEWED_NOTES_INTERNAL_B_UI } from './i18n/notes_internal_b.reviewed'
import { REVIEWED_NOTES_INTERNAL_C_UI } from './i18n/notes_internal_c.reviewed'
import { REVIEWED_NOTES_INTERNAL_D_UI } from './i18n/notes_internal_d.reviewed'
import { REVIEWED_SHELL_INTERNAL_A_UI } from './i18n/shell_internal_a.reviewed'
import { REVIEWED_SHELL_INTERNAL_B_UI } from './i18n/shell_internal_b.reviewed'
import { REVIEWED_SHELL_INTERNAL_C_UI } from './i18n/shell_internal_c.reviewed'
import { REVIEWED_SHELL_INTERNAL_D_UI } from './i18n/shell_internal_d.reviewed'
import { REVIEWED_SHELL_INTERNAL_E_UI } from './i18n/shell_internal_e.reviewed'
import { REVIEWED_READER_FAILURE_A_UI } from './i18n/reader_failure_a.reviewed'
import { REVIEWED_READER_FAILURE_B_UI } from './i18n/reader_failure_b.reviewed'
import { REVIEWED_READER_FAILURE_C_UI } from './i18n/reader_failure_c.reviewed'
import { REVIEWED_READER_FAILURE_D_UI } from './i18n/reader_failure_d.reviewed'
import { REVIEWED_READER_FAILURE_E_UI } from './i18n/reader_failure_e.reviewed'
import { REVIEWED_EPUB_IMPORT_ERRORS_UI } from './i18n/epub_import_errors.reviewed'
import { REVIEWED_BROWSE_EXTRA_UI } from './i18n/browse_extra.reviewed'
import { REVIEWED_READER_INTERNAL_A_UI } from './i18n/reader_internal_a.reviewed'
import { REVIEWED_READER_INTERNAL_B_UI } from './i18n/reader_internal_b.reviewed'
import { REVIEWED_READER_INTERNAL_C_UI } from './i18n/reader_internal_c.reviewed'
import { REVIEWED_READER_INTERNAL_D_UI } from './i18n/reader_internal_d.reviewed'
import { REVIEWED_READER_INTERNAL_E_UI } from './i18n/reader_internal_e.reviewed'
import { REVIEWED_READER_INTERNAL_F_UI } from './i18n/reader_internal_f.reviewed'
import { REVIEWED_READER_INTERNAL_G_UI } from './i18n/reader_internal_g.reviewed'
import { REVIEWED_READER_INTERNAL_H_UI } from './i18n/reader_internal_h.reviewed'
import { REVIEWED_SEARCH_INTERNAL_A_UI } from './i18n/search_internal_a.reviewed'
import { REVIEWED_SEARCH_INTERNAL_B_UI } from './i18n/search_internal_b.reviewed'
import { REVIEWED_SEARCH_INTERNAL_C_UI } from './i18n/search_internal_c.reviewed'
import { REVIEWED_SEARCH_INTERNAL_D_UI } from './i18n/search_internal_d.reviewed'
import { REVIEWED_SEARCH_INTERNAL_E_UI } from './i18n/search_internal_e.reviewed'
import { REVIEWED_SEARCH_DYNAMIC_F_TEMPLATES } from './i18n/search_dynamic_f.reviewed'
import { REVIEWED_SEARCH_QUERY_DYNAMIC_TEMPLATES } from './i18n/search_query_dynamic.reviewed'
import { REVIEWED_SEARCH_COVERAGE_DYNAMIC_TEMPLATES } from './i18n/search_coverage_dynamic.reviewed'
import { REVIEWED_SEARCH_FILTER_DYNAMIC_TEMPLATES } from './i18n/search_filters_dynamic.reviewed'
import { REVIEWED_SETTINGS_ARCHIVE_PREVIEW_DYNAMIC_TEMPLATES } from './i18n/settings_archive_preview_dynamic.reviewed'
import { REVIEWED_ME_ACCOUNT_BOOKS_UI, REVIEWED_ME_ACCOUNT_BOOK_DYNAMIC_TEMPLATES } from './i18n/me_account_books.reviewed'
import { REVIEWED_ADMIN_CENTRAL_MUTATIONS_UI } from './i18n/admin_central_mutations.reviewed'
import { REVIEWED_READER_SEARCH_DYNAMIC_TEMPLATES } from './i18n/reader_search_dynamic.reviewed'
import { REVIEWED_LIBRARY_BULK_DYNAMIC_TEMPLATES } from './i18n/library_bulk_dynamic.reviewed'
import { REVIEWED_ME_SUMMARY_DYNAMIC_TEMPLATES } from './i18n/me_summary_dynamic.reviewed'
import { REVIEWED_READER_DOCUMENT_ARIA_DYNAMIC_TEMPLATES } from './i18n/reader_document_aria_dynamic.reviewed'
import { REVIEWED_READER_STATUS_DYNAMIC_TEMPLATES } from './i18n/reader_status_dynamic.reviewed'
import { REVIEWED_EDITIONS_SERIES_INTERNAL_UI } from './i18n/editions_series_internal.reviewed'
import { REVIEWED_SHELVES_INTERNAL_UI } from './i18n/shelves_internal.reviewed'
import { REVIEWED_NOTES_INTERNAL_E_UI } from './i18n/notes_internal_e.reviewed'
import { REVIEWED_NOTES_INTERNAL_F_UI } from './i18n/notes_internal_f.reviewed'
import { REVIEWED_READER_TOC_ALL_UI, translateReaderTocDynamic } from './i18n/reader_toc_all.reviewed'
import { REVIEWED_READER_TOOLBAR_ALL_UI } from './i18n/reader_toolbar_all.reviewed'
import { REVIEWED_READER_HEADER_ALL_UI } from './i18n/reader_header_all.reviewed'
import { REVIEWED_ROUTE_RECOVERY_ALL_UI } from './i18n/route_recovery_all.reviewed'
import { REVIEWED_READER_ROUTE_RECOVERY_ALL_UI } from './i18n/reader_route_recovery_all.reviewed'
import { REVIEWED_READER_ORIGINAL_DOWNLOADS_ALL_UI } from './i18n/reader_original_downloads_all.reviewed'
import { REVIEWED_READER_TEXT_FALLBACKS_ALL_UI } from './i18n/reader_text_fallbacks_all.reviewed'
import { REVIEWED_READER_SOURCE_MISSING_ALL_UI } from './i18n/reader_source_missing_all.reviewed'
import { REVIEWED_READER_SOURCE_FAILURES_ALL_UI } from './i18n/reader_source_failures_all.reviewed'
import { REVIEWED_READER_ORIGINAL_FORMATS_ALL_UI } from './i18n/reader_original_formats_all.reviewed'
import { REVIEWED_READER_PDF_DOWNLOADS_ALL_UI } from './i18n/reader_pdf_downloads_all.reviewed'
import { REVIEWED_READER_PDF_AVAILABILITY_ALL_UI } from './i18n/reader_pdf_availability_all.reviewed'
import { REVIEWED_READER_PDF_PREVIEW_ALL_UI } from './i18n/reader_pdf_preview_all.reviewed'
import { REVIEWED_READER_PDF_LOADING_ALL_UI } from './i18n/reader_pdf_loading_all.reviewed'
import { REVIEWED_READER_BOOK_FAILURE_ALL_UI } from './i18n/reader_book_failure_all.reviewed'
import { REVIEWED_READER_ANNOTATIONS_EMPTY_ALL_UI } from './i18n/reader_annotations_empty_all.reviewed'
import { REVIEWED_READER_ANNOTATIONS_ACTIONS_ALL_UI, translateReaderAnnotationsDynamic } from './i18n/reader_annotations_actions_all.reviewed'
import { translateReaderAnnotationNavigation } from './i18n/reader_annotation_navigation_all.reviewed'
import { REVIEWED_READER_BOOK_CARD_ALL_UI } from './i18n/reader_book_card_all.reviewed'
import { REVIEWED_BOOK_IMPORT_LAUNCHER_ALL_UI } from './i18n/book_import_launcher_all.reviewed'
import { REVIEWED_BOOK_IMPORT_LAUNCHER_DESCRIPTION_ALL_UI } from './i18n/book_import_launcher_description_all.reviewed'
import { REVIEWED_BOOK_IMPORT_REVIEW_ALL_UI } from './i18n/book_import_review_all.reviewed'
import { REVIEWED_BOOK_IMPORT_REVIEW_ACTIONS_ALL_UI, translateBookImportReviewDynamic } from './i18n/book_import_review_actions_all.reviewed'
import { REVIEWED_BOOK_IMPORT_INTAKE_ALL_UI, translateBookImportProgress } from './i18n/book_import_intake_all.reviewed'
import { REVIEWED_BOOK_IMPORT_VALIDATION_ALL_UI } from './i18n/book_import_validation_all.reviewed'
import { REVIEWED_BOOK_IMPORT_IDENTITY_FIELDS_ALL_UI } from './i18n/book_import_identity_fields_all.reviewed'
import { REVIEWED_BOOK_IMPORT_PUBLICATION_FIELDS_ALL_UI } from './i18n/book_import_publication_fields_all.reviewed'
import { REVIEWED_BOOK_IMPORT_PEOPLE_COVER_FIELDS_ALL_UI } from './i18n/book_import_people_cover_fields_all.reviewed'
import { REVIEWED_BOOK_IMPORT_PDF_COVER_FEEDBACK_ALL_UI } from './i18n/book_import_pdf_cover_feedback_all.reviewed'
import { REVIEWED_BOOK_IMPORT_FORMAT_VALIDATION_ALL_UI } from './i18n/book_import_format_validation_all.reviewed'
import { REVIEWED_BOOK_IMPORT_EMPTY_REPORT_ALL_UI } from './i18n/book_import_empty_report_all.reviewed'
import { REVIEWED_BOOK_IMPORT_AUTHOR_BATCH_LABELS_ALL_UI } from './i18n/book_import_author_batch_labels_all.reviewed'
import { REVIEWED_BOOK_IMPORT_BATCH_PANEL_ALL_UI } from './i18n/book_import_batch_panel_all.reviewed'

export const UI_LOCALE_CATALOGS = {
  ckb: { reviewed: REVIEWED_CKB_UI, fallback: 'ar' },
  ku: { reviewed: REVIEWED_KU_UI, fallback: 'ar' },
  tr: { reviewed: REVIEWED_TR_UI, fallback: 'ar' },
  ur: { reviewed: REVIEWED_UR_UI, fallback: 'ar' },
  fa: { reviewed: REVIEWED_FA_UI, fallback: 'ar' },
} as const

/**
 * قاموس الواجهة الثابت. لا يمر عبر الشبكة ولا يستهلك حصة الترجمة.
 * المفاتيح العربية هي النصوص المصدرية نفسها كي يكشف الاختبار أي تغيير غير مترجم.
 */
export const UI_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: { ...GENERATED_EN_UI, ...REVIEWED_EN_UI, ...ADMIN_INDEXING_EN },
  fr: { ...GENERATED_FR_UI, ...REVIEWED_FR_UI },
  ckb: { ...UI_LOCALE_CATALOGS.ckb.reviewed },
  ku: { ...UI_LOCALE_CATALOGS.ku.reviewed },
  tr: { ...UI_LOCALE_CATALOGS.tr.reviewed },
  ur: { ...UI_LOCALE_CATALOGS.ur.reviewed },
  ug: { 'الرئيسية':'باش بەت','القرآن':'قۇرئان','مكتبتي':'كۇتۇپخانام','المؤلفون':'ئاپتورلار','بحث':'ئىزدەش','رفوفي':'تەكچىلىرىم','الإعدادات':'تەڭشەكلەر','الخِزانة':'خەزىنىە','لغة الموقع':'بېكەت تىلى','ترجمة الصفحة':'بەتنى تەرجىمە قىلىش' },
  fa: { ...UI_LOCALE_CATALOGS.fa.reviewed },
  sw: { 'الرئيسية':'Mwanzo','القرآن':'Kurani','مكتبتي':'Maktaba yangu','المؤلفون':'Waandishi','بحث':'Tafuta','رفوفي':'Rafu zangu','الإعدادات':'Mipangilio','الخِزانة':'Al-Khezana','لغة الموقع':'Lugha ya tovuti','ترجمة الصفحة':'Tafsiri ukurasa' },
  hi: { 'الرئيسية':'मुखपृष्ठ','القرآن':'क़ुरआन','مكتبتي':'मेरी लाइब्रेरी','المؤلفون':'लेखक','بحث':'खोज','رفوفي':'मेरी अलमारियाँ','الإعدادات':'सेटिंग्स','الخِزانة':'अल-ख़ज़ाना','لغة الموقع':'साइट की भाषा','ترجمة الصفحة':'पृष्ठ का अनुवाद करें' },
  hu: { 'الرئيسية':'Kezdőlap','القرآن':'Korán','مكتبتي':'Könyvtáram','المؤلفون':'Szerzők','بحث':'Keresés','رفوفي':'Polcaim','الإعدادات':'Beállítások','الخِزانة':'Al-Khezana','لغة الموقع':'Webhely nyelve','ترجمة الصفحة':'Oldal fordítása' },
  id: { 'الرئيسية':'Beranda','القرآن':'Al-Qur’an','مكتبتي':'Perpustakaan saya','المؤلفون':'Penulis','بحث':'Cari','رفوفي':'Rak saya','الإعدادات':'Pengaturan','الخِزانة':'Al-Khezana','لغة الموقع':'Bahasa situs','ترجمة الصفحة':'Terjemahkan halaman' },
  ms: { 'الرئيسية':'Utama','القرآن':'Al-Quran','مكتبتي':'Perpustakaan saya','المؤلفون':'Pengarang','بحث':'Cari','رفوفي':'Rak saya','الإعدادات':'Tetapan','الخِزانة':'Al-Khezana','لغة الموقع':'Bahasa laman','ترجمة الصفحة':'Terjemah halaman' },
  bn: { 'الرئيسية':'প্রচ্ছদ','القرآن':'কুরআন','مكتبتي':'আমার গ্রন্থাগার','المؤلفون':'লেখক','بحث':'অনুসন্ধান','رفوفي':'আমার তাক','الإعدادات':'সেটিংস','الخِزانة':'আল-খাযানা','لغة الموقع':'সাইটের ভাষা','ترجمة الصفحة':'পৃষ্ঠা অনুবাদ' },
  ps: { 'الرئيسية':'کور','القرآن':'قرآن','مكتبتي':'زما کتابتون','المؤلفون':'لیکوالان','بحث':'لټون','رفوفي':'زما المارۍ','الإعدادات':'امستنې','الخِزانة':'الخزانه','لغة الموقع':'د سایټ ژبه','ترجمة الصفحة':'پاڼه وژباړئ' },
  so: { 'الرئيسية':'Bogga hore','القرآن':'Quraan','مكتبتي':'Maktabaddayda','المؤلفون':'Qorayaal','بحث':'Raadi','رفوفي':'Khaanadahayga','الإعدادات':'Dejinta','الخِزانة':'Al-Khezana','لغة الموقع':'Luqadda bogga','ترجمة الصفحة':'Turjun bogga' },
  ha: { 'الرئيسية':'Gida','القرآن':'Alƙur’ani','مكتبتي':'Ɗakin karatuna','المؤلفون':'Marubuta','بحث':'Bincika','رفوفي':'Shiryayyu na','الإعدادات':'Saituna','الخِزانة':'Al-Khezana','لغة الموقع':'Harshen shafi','ترجمة الصفحة':'Fassara shafi' },
  ru: { 'الرئيسية':'Главная','القرآن':'Коран','مكتبتي':'Моя библиотека','المؤلفون':'Авторы','بحث':'Поиск','رفوفي':'Мои полки','الإعدادات':'Настройки','الخِزانة':'Аль-Хазана','لغة الموقع':'Язык сайта','ترجمة الصفحة':'Перевести страницу' },
  uk: { 'الرئيسية':'Головна','القرآن':'Коран','مكتبتي':'Моя бібліотека','المؤلفون':'Автори','بحث':'Пошук','رفوفي':'Мої полиці','الإعدادات':'Налаштування','الخِزانة':'Аль-Хазана','لغة الموقع':'Мова сайту','ترجمة الصفحة':'Перекласти сторінку' },
  de: { 'الرئيسية':'Startseite','القرآن':'Koran','مكتبتي':'Meine Bibliothek','المؤلفون':'Autoren','بحث':'Suche','رفوفي':'Meine Regale','الإعدادات':'Einstellungen','الخِزانة':'Al-Khezana','لغة الموقع':'Seitensprache','ترجمة الصفحة':'Seite übersetzen' },
  es: { 'الرئيسية':'Inicio','القرآن':'Corán','مكتبتي':'Mi biblioteca','المؤلفون':'Autores','بحث':'Buscar','رفوفي':'Mis estantes','الإعدادات':'Ajustes','الخِزانة':'Al-Khezana','لغة الموقع':'Idioma del sitio','ترجمة الصفحة':'Traducir página' },
  pt: { 'الرئيسية':'Início','القرآن':'Alcorão','مكتبتي':'Minha biblioteca','المؤلفون':'Autores','بحث':'Pesquisar','رفوفي':'Minhas estantes','الإعدادات':'Definições','الخِزانة':'Al-Khezana','لغة الموقع':'Idioma do site','ترجمة الصفحة':'Traduzir página' },
  it: { 'الرئيسية':'Home','القرآن':'Corano','مكتبتي':'La mia biblioteca','المؤلفون':'Autori','بحث':'Cerca','رفوفي':'I miei scaffali','الإعدادات':'Impostazioni','الخِزانة':'Al-Khezana','لغة الموقع':'Lingua del sito','ترجمة الصفحة':'Traduci pagina' },
  nl: { 'الرئيسية':'Start','القرآن':'Koran','مكتبتي':'Mijn bibliotheek','المؤلفون':'Auteurs','بحث':'Zoeken','رفوفي':'Mijn planken','الإعدادات':'Instellingen','الخِزانة':'Al-Khezana','لغة الموقع':'Websitetaal','ترجمة الصفحة':'Pagina vertalen' },
  sv: { 'الرئيسية':'Hem','القرآن':'Koranen','مكتبتي':'Mitt bibliotek','المؤلفون':'Författare','بحث':'Sök','رفوفي':'Mina hyllor','الإعدادات':'Inställningar','الخِزانة':'Al-Khezana','لغة الموقع':'Webbplatsspråk','ترجمة الصفحة':'Översätt sidan' },
  no: { 'الرئيسية':'Hjem','القرآن':'Koranen','مكتبتي':'Mitt bibliotek','المؤلفون':'Forfattere','بحث':'Søk','رفوفي':'Mine hyller','الإعدادات':'Innstillinger','الخِزانة':'Al-Khezana','لغة الموقع':'Nettstedsspråk','ترجمة الصفحة':'Oversett siden' },
  pl: { 'الرئيسية':'Strona główna','القرآن':'Koran','مكتبتي':'Moja biblioteka','المؤلفون':'Autorzy','بحث':'Szukaj','رفوفي':'Moje półki','الإعدادات':'Ustawienia','الخِزانة':'Al-Khezana','لغة الموقع':'Język witryny','ترجمة الصفحة':'Przetłumacz stronę' },
  ro: { 'الرئيسية':'Acasă','القرآن':'Coran','مكتبتي':'Biblioteca mea','المؤلفون':'Autori','بحث':'Caută','رفوفي':'Rafturile mele','الإعدادات':'Setări','الخِزانة':'Al-Khezana','لغة الموقع':'Limba site-ului','ترجمة الصفحة':'Tradu pagina' },
  bs: { 'الرئيسية':'Početna','القرآن':'Kur’an','مكتبتي':'Moja biblioteka','المؤلفون':'Autori','بحث':'Pretraga','رفوفي':'Moje police','الإعدادات':'Postavke','الخِزانة':'Al-Khezana','لغة الموقع':'Jezik stranice','ترجمة الصفحة':'Prevedi stranicu' },
  sq: { 'الرئيسية':'Kryefaqja','القرآن':'Kurani','مكتبتي':'Biblioteka ime','المؤلفون':'Autorët','بحث':'Kërko','رفوفي':'Raftet e mia','الإعدادات':'Cilësimet','الخِزانة':'Al-Khezana','لغة الموقع':'Gjuha e faqes','ترجمة الصفحة':'Përkthe faqen' },
  az: { 'الرئيسية':'Ana səhifə','القرآن':'Quran','مكتبتي':'Kitabxanam','المؤلفون':'Müəlliflər','بحث':'Axtar','رفوفي':'Rəflərim','الإعدادات':'Ayarlar','الخِزانة':'Əl-Xəzanə','لغة الموقع':'Saytın dili','ترجمة الصفحة':'Səhifəni tərcümə et' },
  uz: { 'الرئيسية':'Bosh sahifa','القرآن':'Qur’on','مكتبتي':'Kutubxonam','المؤلفون':'Mualliflar','بحث':'Qidirish','رفوفي':'Javonlarim','الإعدادات':'Sozlamalar','الخِزانة':'Al-Xazana','لغة الموقع':'Sayt tili','ترجمة الصفحة':'Sahifani tarjima qilish' },
  kk: { 'الرئيسية':'Басты бет','القرآن':'Құран','مكتبتي':'Кітапханам','المؤلفون':'Авторлар','بحث':'Іздеу','رفوفي':'Сөрелерім','الإعدادات':'Баптаулар','الخِزانة':'Әл-Хазана','لغة الموقع':'Сайт тілі','ترجمة الصفحة':'Бетті аудару' },
  zh: { 'الرئيسية':'首页','القرآن':'古兰经','مكتبتي':'我的图书馆','المؤلفون':'作者','بحث':'搜索','رفوفي':'我的书架','الإعدادات':'设置','الخِزانة':'宝库','لغة الموقع':'网站语言','ترجمة الصفحة':'翻译页面' },
  ja: { 'الرئيسية':'ホーム','القرآن':'クルアーン','مكتبتي':'マイライブラリ','المؤلفون':'著者','بحث':'検索','رفوفي':'本棚','الإعدادات':'設定','الخِزانة':'アル・ハザーナ','لغة الموقع':'サイトの言語','ترجمة الصفحة':'ページを翻訳' },
  ko: { 'الرئيسية':'홈','القرآن':'꾸란','مكتبتي':'내 서재','المؤلفون':'저자','بحث':'검색','رفوفي':'내 책장','الإعدادات':'설정','الخِزانة':'알카자나','لغة الموقع':'사이트 언어','ترجمة الصفحة':'페이지 번역' },
}

for (const [code, reviewed] of Object.entries(REVIEWED_ROUTE_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_INNER_ROUTE_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_SETTINGS_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_LIBRARY_INNER_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_MEMORY_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_WORKFLOW_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_DIALOG_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_NOTES_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_SHELVES_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_SETTINGS_BACKUP_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_HEADER_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_RECOVERY_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_COMPLETION_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_GUIDANCE_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_READING_PLANS_PROGRESS_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_RESEARCH_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_QUALITY_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_QUALITY_CORE_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_QUALITY_FILTERS_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_QUALITY_STATES_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_SUBMISSIONS_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_AUDIT_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ADMIN_STATS_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_DISCOVER_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_NEW_BOOKS_CORE_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_NEW_BOOKS_STATES_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_NEW_BOOKS_FAILURES_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_EDITIONS_SERIES_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_EDITIONS_INTERNAL_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_SERIES_ALL_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_ME_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_BOOK_PAGE_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_HOME_DAILY_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_SOURCE_SYNC_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_OFFLINE_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_APPEARANCE_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_WELCOME_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}

for (const [code, reviewed] of Object.entries(REVIEWED_FEATURES_INTRO_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}
for (const [code, reviewed] of Object.entries(REVIEWED_FEATURES_READER_UI)) {
  Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_WORKFLOW_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_ACCESS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_CATALOG_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_KNOWLEDGE_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_VISION_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_AI_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_FEATURES_INDEX_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ACCESSIBILITY_BRAND_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_QURAN_TOOLS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_QURAN_MODES_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_QURAN_AUDIO_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_QURAN_FEEDBACK_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SUNNAH_SOURCES_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SUNNAH_CATEGORIES_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SUNNAH_ROOM_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SUNNAH_SCIENCES_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_CORE_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_METADATA_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_BATCH_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_VALIDATION_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_FIELDS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_OPTIONS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_GUIDANCE_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_CONVERSION_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_H_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_I_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_J_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_K_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_L_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_M_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_N_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_O_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_P_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_Q_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_R_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_S_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_T_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_U_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_V_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_W_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_X_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_Y_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_Z_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AA_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AB_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AC_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AD_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AE_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AF_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AG_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AH_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AI_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AJ_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AK_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AM_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AN_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AO_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AP_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AQ_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AR_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AT_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_LIBRARY_ADMIN_AU_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_H_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_I_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_J_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_K_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_L_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_TRANSLATION_PANEL_M_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_H_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_I_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_HOME_INTERNAL_J_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_INTERNAL_H_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ME_ACCOUNT_BOOKS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ADMIN_CENTRAL_MUTATIONS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_INTERNAL_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELL_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELL_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELL_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELL_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELL_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_FAILURE_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_FAILURE_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_FAILURE_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_FAILURE_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_FAILURE_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_EPUB_IMPORT_ERRORS_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BROWSE_EXTRA_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_G_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_INTERNAL_H_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SEARCH_INTERNAL_A_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SEARCH_INTERNAL_B_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SEARCH_INTERNAL_C_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SEARCH_INTERNAL_D_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SEARCH_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_EDITIONS_SERIES_INTERNAL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SHELVES_INTERNAL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_E_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_NOTES_INTERNAL_F_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_TOC_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_TOOLBAR_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_HEADER_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ROUTE_RECOVERY_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_ROUTE_RECOVERY_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_ORIGINAL_DOWNLOADS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_TEXT_FALLBACKS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_SOURCE_MISSING_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_SOURCE_FAILURES_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_ORIGINAL_FORMATS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_PDF_DOWNLOADS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_PDF_AVAILABILITY_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_PDF_PREVIEW_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_PDF_LOADING_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_BOOK_FAILURE_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_ANNOTATIONS_EMPTY_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_ANNOTATIONS_ACTIONS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_READER_BOOK_CARD_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_LAUNCHER_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_LAUNCHER_DESCRIPTION_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_REVIEW_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_REVIEW_ACTIONS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_INTAKE_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_VALIDATION_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_IDENTITY_FIELDS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_PUBLICATION_FIELDS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_PEOPLE_COVER_FIELDS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_PDF_COVER_FEEDBACK_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_FORMAT_VALIDATION_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_EMPTY_REPORT_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_AUTHOR_BATCH_LABELS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_BOOK_IMPORT_BATCH_PANEL_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ACCOUNT_DEVICES_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ACCOUNT_LOGIN_ERRORS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_ACCOUNT_ACCESS_ERRORS_ALL_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}
for(const [code,reviewed] of Object.entries(REVIEWED_SETTINGS_RELEASE_GATE_UI)){Object.assign(UI_TRANSLATIONS[code]??={},reviewed)}

// لا نعدّ المفتاح ذا القيمة الفارغة ترجمة محلية. حزم التوليد القديمة
// احتوت مدخل «ة» فارغًا؛ حذفه يجعل الرجوع إلى العربية صريحًا وقابلًا للتدقيق.
for (const [code, reviewed] of Object.entries(REVIEWED_HOME_STATISTICS_ALL_UI)) Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
// Preserve already reviewed labels; this batch fills missing languages only.
for (const [code, reviewed] of Object.entries(REVIEWED_SHARED_CONTROLS_ALL_UI)) {
  const catalog = UI_TRANSLATIONS[code] ??= {}
  for (const [source, translated] of Object.entries(reviewed)) catalog[source] ??= translated
}
for (const [code, reviewed] of Object.entries(REVIEWED_AUTHOR_FORM_ALL_UI)) {
  const catalog = UI_TRANSLATIONS[code] ??= {}
  for (const [source, translated] of Object.entries(reviewed)) catalog[source] ??= translated
}
for (const [code, reviewed] of Object.entries(REVIEWED_BOOK_SORT_ALL_UI)) Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
addAuthorInlineTranslations(UI_TRANSLATIONS)
for (const [code, reviewed] of Object.entries(REVIEWED_SIGN_IN_ALL_UI)) {
  const catalog = UI_TRANSLATIONS[code] ??= {}
  for (const [source, translated] of Object.entries(reviewed)) catalog[source] ??= translated
}
for (const [code, reviewed] of Object.entries(REVIEWED_QUOTES_PUBLIC_ALL_UI)) {
  const catalog = UI_TRANSLATIONS[code] ??= {}
  for (const [source, translated] of Object.entries(reviewed)) catalog[source] ??= translated
}
for (const batch of [REVIEWED_ACCOUNT_CURRENT_ALL_UI, REVIEWED_WELCOME_CURRENT_ALL_UI, REVIEWED_PWA_INSTALL_ALL_UI, REVIEWED_QUOTES_CURRENT_ALL_UI, REVIEWED_SETTINGS_CURRENT_ALL_UI, REVIEWED_SETTINGS_BACKUP_CURRENT_ALL_UI, REVIEWED_FEATURES_CURRENT_ALL_UI]) {
  for (const [code, reviewed] of Object.entries(batch)) Object.assign(UI_TRANSLATIONS[code] ??= {}, reviewed)
}
Object.assign(UI_TRANSLATIONS.en ??= {}, COMPLETED_EN_UI)
Object.assign(UI_TRANSLATIONS.en ??= {}, REVIEWED_EN_INTERFACE_GAPS)
for (const catalog of Object.values(UI_TRANSLATIONS)) {
  for (const [source, translated] of Object.entries(catalog)) {
    if (!source.trim() || !translated.trim()) delete catalog[source]
  }
}

export function auditVisibleUiLanguageCatalogs(languageCodes: readonly string[]): string[] {
  const issues: string[] = []
  for (const code of languageCodes) {
    const catalog = UI_TRANSLATIONS[code]
    if (!catalog) { issues.push(`${code}:missing`); continue }
    if (!Object.keys(catalog).length) issues.push(`${code}:empty-catalog`)
    for (const [source, translated] of Object.entries(catalog)) {
      if (!source.trim()) issues.push(`${code}:blank-source`)
      if (!translated.trim()) issues.push(`${code}:blank:${source}`)
    }
  }
  return issues
}

/**
 * ترحيب الحساب يجمع نص الواجهة باسم عرض يملكه المستخدم. لا يجوز إدخال الاسم
 * في القاموس أو ترجمته، لذلك نترجم البادئة وحدها ثم نعيد الاسم كما هو.
 */
const ACCOUNT_GREETING_PREFIXES: Readonly<Record<string, string>> = {
  en: 'Welcome', fr: 'Bienvenue', ug: 'خۇش كەلدىڭىز', ckb: 'بەخێربێیت',
  ku: 'Bi xêr hatî', tr: 'Hoş geldiniz', ur: 'خوش آمدید', fa: 'خوش آمدید',
  sw: 'Karibu', hi: 'स्वागत है', hu: 'Üdvözöljük', id: 'Selamat datang',
  ms: 'Selamat datang', bn: 'স্বাগতম', ps: 'ښه راغلاست', so: 'Soo dhowow',
  ha: 'Barka da zuwa', ru: 'Добро пожаловать', uk: 'Ласкаво просимо', de: 'Willkommen',
  es: 'Bienvenido', pt: 'Bem-vindo', it: 'Benvenuto', nl: 'Welkom',
  sv: 'Välkommen', no: 'Velkommen', pl: 'Witamy', ro: 'Bun venit',
  bs: 'Dobro došli', sq: 'Mirë se vini', az: 'Xoş gəlmisiniz', uz: 'Xush kelibsiz',
  kk: 'Қош келдіңіз', zh: '欢迎', ja: 'ようこそ', ko: '환영합니다',
}

function translateAccountGreeting(source: string, language: string): string | undefined {
  const match = source.match(/^مرحبًا(?:\s+(.+))?$/u)
  if (!match) return undefined
  const prefix = ACCOUNT_GREETING_PREFIXES[language]
  if (!prefix) return undefined
  const displayName = match[1]?.trim()
  return displayName ? `${prefix} ${displayName}` : prefix
}

const BOOK_COUNT_UNITS: Readonly<Record<string, string>> = {
  en: 'books', fr: 'livres', ug: 'كىتاب', ckb: 'کتێب', ku: 'pirtûk', tr: 'kitap',
  ur: 'کتابیں', fa: 'کتاب', sw: 'vitabu', hi: 'किताबें', hu: 'könyv', id: 'buku',
  ms: 'buku', bn: 'বই', ps: 'کتابونه', so: 'buug', ha: 'littattafai', ru: 'книг',
  uk: 'книг', de: 'Bücher', es: 'libros', pt: 'livros', it: 'libri', nl: 'boeken',
  sv: 'böcker', no: 'bøker', pl: 'książek', ro: 'cărți', bs: 'knjiga', sq: 'libra',
  az: 'kitab', uz: 'kitob', kk: 'кітап', zh: '本书', ja: '冊', ko: '권',
}

/** عدّاد واجهة فقط؛ يبقي الرقم القادم من الحالة كما هو ولا يترجم بيانات كتاب. */
function translateBookCount(source: string, language: string): string | undefined {
  const match = source.match(/^([0-9٠-٩]+)\s+كتاب(?:ًا|ا)?$/u)
  if (!match) return undefined
  const unit = BOOK_COUNT_UNITS[language]
  if (!unit) return undefined
  return ['zh', 'ja', 'ko'].includes(language) ? `${match[1]}${unit}` : `${match[1]} ${unit}`
}

const OPENED_COUNT_TEMPLATES: Readonly<Record<string, (count: string) => string>> = {
  en: count => `Opened ${count} times`, fr: count => `Ouvert ${count} fois`,
  ug: count => `${count} قېتىم ئېچىلدى`, ckb: count => `${count} جار کرایەوە`, ku: count => `${count} caran hate vekirin`,
  tr: count => `${count} kez açıldı`, ur: count => `${count} بار کھولی گئی`, fa: count => `${count} بار باز شده`,
  sw: count => `Imefunguliwa mara ${count}`, hi: count => `${count} बार खोली गई`, hu: count => `${count} alkalommal megnyitva`,
  id: count => `Dibuka ${count} kali`, ms: count => `Dibuka ${count} kali`, bn: count => `${count} বার খোলা হয়েছে`,
  ps: count => `${count} ځله پرانیستل شوی`, so: count => `La furay ${count} jeer`, ha: count => `An buɗe sau ${count}`,
  ru: count => `Открыто ${count} раз`, uk: count => `Відкрито ${count} разів`, de: count => `${count}-mal geöffnet`,
  es: count => `Abierto ${count} veces`, pt: count => `Aberto ${count} vezes`, it: count => `Aperto ${count} volte`,
  nl: count => `${count} keer geopend`, sv: count => `Öppnad ${count} gånger`, no: count => `Åpnet ${count} ganger`,
  pl: count => `Otwarto ${count} razy`, ro: count => `Deschisă de ${count} ori`, bs: count => `Otvoreno ${count} puta`,
  sq: count => `Hapur ${count} herë`, az: count => `${count} dəfə açılıb`, uz: count => `${count} marta ochilgan`,
  kk: count => `${count} рет ашылды`, zh: count => `已打开${count}次`, ja: count => `${count}回開きました`, ko: count => `${count}회 열림`,
}

function translateOpenedCount(source: string, language: string): string | undefined {
  const match = source.match(/^فُتح\s+([0-9٠-٩]+)\s+مرة$/u)
  const render = OPENED_COUNT_TEMPLATES[language]
  return match?.[1] && render ? render(match[1]) : undefined
}

const READING_PROGRESS_TEMPLATES: Readonly<Record<string, (page: string) => string>> = {
  en: page => `Continue reading - you reached page ${page}`, fr: page => `Reprendre la lecture - page ${page}`,
  ug: page => `ئوقۇشنى داۋاملاشتۇرۇڭ - ${page}-بەتكە يەتتىڭىز`, ckb: page => `خوێندنەوە بەردەوام بکە - گەیشتیتە پەڕەی ${page}`,
  ku: page => `Xwendinê bidomîne - gihîştî rûpela ${page}`, tr: page => `Okumaya devam edin - ${page}. sayfaya ulaştınız`,
  ur: page => `پڑھنا جاری رکھیں - آپ صفحہ ${page} تک پہنچے`, fa: page => `مطالعه را ادامه دهید - به صفحهٔ ${page} رسیده‌اید`,
  sw: page => `Endelea kusoma - umefika ukurasa wa ${page}`, hi: page => `पढ़ना जारी रखें - आप पृष्ठ ${page} पर पहुँचे`,
  hu: page => `Olvasás folytatása - elérte a(z) ${page}. oldalt`, id: page => `Lanjutkan membaca - Anda mencapai halaman ${page}`,
  ms: page => `Teruskan membaca - anda sampai ke halaman ${page}`, bn: page => `পড়া চালিয়ে যান - আপনি ${page} পৃষ্ঠায় পৌঁছেছেন`,
  ps: page => `لوستلو ته دوام ورکړئ - ${page} مخ ته ورسېدئ`, so: page => `Sii wad akhriska - waxaad gaartay bogga ${page}`,
  ha: page => `Ci gaba da karatu - ka kai shafi na ${page}`, ru: page => `Продолжить чтение - страница ${page}`,
  uk: page => `Продовжити читання - сторінка ${page}`, de: page => `Weiterlesen - Sie sind auf Seite ${page}`,
  es: page => `Seguir leyendo - llegó a la página ${page}`, pt: page => `Continuar a ler - chegou à página ${page}`,
  it: page => `Continua a leggere - sei a pagina ${page}`, nl: page => `Verder lezen - u bent bij pagina ${page}`,
  sv: page => `Fortsätt läsa - du är på sida ${page}`, no: page => `Fortsett å lese - du er på side ${page}`,
  pl: page => `Czytaj dalej - strona ${page}`, ro: page => `Continuă lectura - ai ajuns la pagina ${page}`,
  bs: page => `Nastavi čitati - stigli ste do stranice ${page}`, sq: page => `Vazhdo leximin - arrite në faqen ${page}`,
  az: page => `Oxumağa davam edin - ${page}-ci səhifəyə çatdınız`, uz: page => `O‘qishni davom ettiring - ${page}-sahifaga yetdingiz`,
  kk: page => `Оқуды жалғастыру - ${page}-бетке жеттіңіз`, zh: page => `继续阅读 - 已读到第${page}页`,
  ja: page => `続きを読む - ${page}ページまで読みました`, ko: page => `계속 읽기 - ${page}페이지까지 읽었습니다`,
}

function translateReadingProgress(source: string, language: string): string | undefined {
  const match = source.match(/^أكمل قراءتك\s*[—–-]\s*فقد وصلتَ إلى ص\s*([0-9٠-٩]+)$/u)
  const render = READING_PROGRESS_TEMPLATES[language]
  return match?.[1] && render ? render(match[1]) : undefined
}

function translateReadingPlanProgress(source: string, language: string): string | undefined {
  const templates = REVIEWED_READING_PLAN_PROGRESS_TEMPLATES[language]
  if (!templates) return undefined
  const reached = source.match(/^وصلت إلى الصفحة\s+([0-9٠-٩]+)$/u)
  if (reached?.[1]) return templates.reached(reached[1])
  const daily = source.match(/^ورد اليوم:\s+([0-9٠-٩]+)\s+صفحة للحاق بالهدف$/u)
  if (daily?.[1]) return templates.daily(daily[1])
  const remaining = source.match(/^نحو\s+([0-9٠-٩]+)\s+أيام متبقية$/u)
  return remaining?.[1] ? templates.remaining(remaining[1]) : undefined
}

function translateResearchDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_RESEARCH_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const page = source.match(/^صفحة\s+([0-9٠-٩]+)$/u)
  if (page?.[1]) return templates.page(page[1])
  const selected = source.match(/^([0-9٠-٩]+)\s+فوائد مختارة$/u)
  if (selected?.[1]) return templates.selected(selected[1])
  const confirmation = source.match(/^حذف مشروع «(.+)»؟ لن تُحذف الملاحظات والتظليلات\.$/u)
  return confirmation?.[1] ? templates.confirmDelete(confirmation[1]) : undefined
}

function translateSettingsDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SETTINGS_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const archiveReady = source.match(/^جُهز أرشيف\s+([0-9٠-٩]+)\s+كتاب$/u)
  if (archiveReady?.[1]) return templates.archiveReady(archiveReady[1])
  const restoreReport = source.match(/^استُعيد\s+([0-9٠-٩]+)\s+·\s+تُجاوز\s+([0-9٠-٩]+)\s+·\s+فشل\s+([0-9٠-٩]+)$/u)
  if (restoreReport?.[1] && restoreReport[2] && restoreReport[3]) return templates.restoreReport(restoreReport[1], restoreReport[2], restoreReport[3])
  const inspectingFile = source.match(/^جارٍ فحص\s+(.+)…$/u)
  if (inspectingFile?.[1]) return templates.inspectingFile(inspectingFile[1])
  const mergeReport = source.match(/^تم الدمج:\s+([0-9٠-٩]+)\s+ملاحظة،\s+([0-9٠-٩]+)\s+تظليل،\s+([0-9٠-٩]+)\s+رف\.$/u)
  if (mergeReport?.[1] && mergeReport[2] && mergeReport[3]) return templates.mergeReport(mergeReport[1], mergeReport[2], mergeReport[3])
  const accountUsage = source.match(/^المستخدم:\s+([0-9٠-٩]+)\s+بايت من\s+([0-9٠-٩]+)\s+بايت$/u)
  if (accountUsage?.[1] && accountUsage[2]) return templates.accountUsage(accountUsage[1], accountUsage[2])
  const offlineOnline = source.match(/^([0-9٠-٩]+)\s+خدمات محلية جاهزة؛ الاتصال متاح\.$/u)
  if (offlineOnline?.[1]) return templates.offlineOnline(offlineOnline[1])
  const offlineUnavailable = source.match(/^([0-9٠-٩]+)\s+خدمات جاهزة الآن، و([0-9٠-٩]+)\s+تحتاج اتصالًا أو أداة جهاز\.$/u)
  return offlineUnavailable?.[1] && offlineUnavailable[2] ? templates.offlineUnavailable(offlineUnavailable[1], offlineUnavailable[2]) : undefined
}

function translateEditionsSeriesDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_EDITIONS_SERIES_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const position = source.match(/^الموضع\s+([0-9٠-٩]+)$/u)
  if (position?.[1]) return templates.position(position[1])
  const verifiedEditions = source.match(/^([0-9٠-٩]+)\s+طبعات موثقة$/u)
  if (verifiedEditions?.[1]) return templates.verifiedEditions(verifiedEditions[1])
  const books = source.match(/^([0-9٠-٩]+)\s+كتب$/u)
  return books?.[1] ? templates.books(books[1]) : undefined
}

function translateShelvesDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SHELVES_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const chooseBook = source.match(/^اختيار كتاب لإضافته إلى رف\s+(.+)$/u)
  if (chooseBook?.[1]) return templates.chooseBook(chooseBook[1])
  const availableBooks = source.match(/^كتب المكتبة المتاحة لرف\s+(.+)$/u)
  if (availableBooks?.[1]) return templates.availableBooks(availableBooks[1])
  const deleteShelf = source.match(/^حذف رف\s+(.+)$/u)
  if (deleteShelf?.[1]) return templates.deleteShelf(deleteShelf[1])
  const removeBook = source.match(/^إزالة\s+(.+)\s+من رف\s+(.+)$/u)
  return removeBook?.[1] && removeBook[2] ? templates.removeBook(removeBook[1], removeBook[2]) : undefined
}

function translateAdminQualityDynamic(source: string, language: string): string | undefined {
  const count = source.match(/^([0-9٠-٩]+)\s+ملاحظة بيانات$/u)
  const countTemplate = REVIEWED_ADMIN_QUALITY_COUNT_TEMPLATES[language]
  if (count?.[1] && countTemplate) return countTemplate(count[1])
  const open = source.match(/^افتح\s+(.+)$/u)
  const openTemplate = REVIEWED_ADMIN_QUALITY_OPEN_TEMPLATES[language]
  return open?.[1] && openTemplate ? openTemplate(open[1]) : undefined
}

function translateNewBooksDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_NEW_BOOKS_DYNAMIC_ALL_TEMPLATES[language]
  if (!templates) return undefined
  const day = source.match(/^الجديد يوم\s+(.+)$/u)
  if (day?.[1]) return templates.day(day[1])
  const shown = source.match(/^عُرض\s+([0-9٠-٩]+)\s+من\s+([0-9٠-٩]+)\s+كتابًا\s+—\s+تابع النزول$/u)
  if (shown?.[1] && shown[2]) return templates.shown(shown[1], shown[2])
  const complete = source.match(/^اكتملت الكتب الجديدة:\s+([0-9٠-٩]+)\s+كتابًا$/u)
  return complete?.[1] ? templates.complete(complete[1]) : undefined
}

function translateNotesDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_NOTES_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const items = source.match(/^([0-9٠-٩]+)\s+عنصرًا$/u)
  if (items?.[1]) return templates.items(items[1])
  const nextReview = source.match(/^المراجعة القادمة:\s+(.+)$/u)
  return nextReview?.[1] ? templates.nextReview(nextReview[1]) : undefined
}

function translateBookPreviewDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_BOOK_PREVIEW_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const part = source.match(/^الجزء\s+([0-9٠-٩]+)$/u)
  if (part?.[1]) return templates.part(part[1])
  const pageRange = source.match(/^من الصفحة\s+([0-9٠-٩]+)\s+إلى\s+([0-9٠-٩]+)$/u)
  return pageRange?.[1] && pageRange[2] ? templates.pageRange(pageRange[1], pageRange[2]) : undefined
}

function translateSearchDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SEARCH_DYNAMIC_F_TEMPLATES[language]
  if (!templates) return undefined
  const summary = source.match(/^([0-9٠-٩]+)\s+موضعًا مطابقًا؛ تعرض البطاقات\s+([0-9٠-٩]+)\s+فقرة من\s+([0-9٠-٩]+)\s+كتاب · العدد ثابت أثناء التصفح$/u)
  if (summary?.[1] && summary[2] && summary[3]) return templates.summary(summary[1], summary[2], summary[3])
  const filteredSummary = source.match(/^([0-9٠-٩]+)\s+موضعًا مطابقًا بعد التصفية في\s+([0-9٠-٩]+)\s+كتاب$/u)
  if (filteredSummary?.[1] && filteredSummary[2]) return templates.filteredSummary(filteredSummary[1], filteredSummary[2])
  const optionLimit = source.match(/^تظهر\s+([0-9٠-٩]+)\s+من\s+([0-9٠-٩]+)؛ ضيّق العبارة لبقية الخيارات\.$/u)
  if (optionLimit?.[1] && optionLimit[2]) return templates.optionLimit(optionLimit[1], optionLimit[2])
  const shown = source.match(/^عُرض\s+([0-9٠-٩]+)\s+من\s+([0-9٠-٩]+)\s+—\s+تابع النزول$/u)
  if (shown?.[1] && shown[2]) return templates.shown(shown[1], shown[2])
  const complete = source.match(/^اكتملت\s+([0-9٠-٩]+)\s+فقرة$/u)
  return complete?.[1] ? templates.complete(complete[1]) : undefined
}

function translateBookReadingPlanDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_BOOK_READING_PLAN_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const pace = source.match(/^([0-9٠-٩]+)\s+دقيقة يوميًا ·\s+([0-9٠-٩]+)\s+صفحات$/u)
  if (pace?.[1] && pace[2]) return templates.pace(pace[1], pace[2])
  const reachedPercent = source.match(/^وصلت إلى\s+([0-9٠-٩]+)٪$/u)
  if (reachedPercent?.[1]) return templates.reachedPercent(reachedPercent[1])
  const todayTarget = source.match(/^هدف اليوم: الصفحة\s+([0-9٠-٩]+)$/u)
  if (todayTarget?.[1]) return templates.todayTarget(todayTarget[1])
  const remainingDays = source.match(/^نحو\s+([0-9٠-٩]+)\s+أيام للإتمام$/u)
  return remainingDays?.[1] ? templates.remainingDays(remainingDays[1]) : undefined
}

function translateBookMetadataDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_BOOK_METADATA_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const deathYear = source.match(/^توفي سنة\s+([0-9٠-٩]+)\s+هـ$/u)
  if (deathYear?.[1]) return templates.deathYear(deathYear[1])
  const wordPagination = source.match(/^([0-9٠-٩]+)\s+·\s+ترقيم Word حتى\s+([0-9٠-٩]+)$/u)
  if (wordPagination?.[1] && wordPagination[2]) return templates.wordPagination(wordPagination[1], wordPagination[2])
  const addedToShelf = source.match(/^أضيف إلى «(.+)»$/u)
  if (addedToShelf?.[1]) return templates.addedToShelf(addedToShelf[1])
  const removedFromShelf = source.match(/^أزيل من «(.+)»$/u)
  return removedFromShelf?.[1] ? templates.removedFromShelf(removedFromShelf[1]) : undefined
}

function translateAdminBookFieldsDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_ADMIN_BOOK_FIELDS_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const reviewNote = source.match(/^ملاحظة مراجعة\s+(.+)$/u)
  if (reviewNote?.[1]) return templates.reviewNote(reviewNote[1])
  const titleField = source.match(/^عنوان\s+(.+)$/u)
  if (titleField?.[1]) return templates.titleField(titleField[1])
  const authorField = source.match(/^مؤلف\s+(.+)$/u)
  if (authorField?.[1]) return templates.authorField(authorField[1])
  const categoryField = source.match(/^تصنيف\s+(.+)$/u)
  if (categoryField?.[1]) return templates.categoryField(categoryField[1])
  const visibilityField = source.match(/^ظهور\s+(.+)$/u)
  return visibilityField?.[1] ? templates.visibilityField(visibilityField[1]) : undefined
}

function translateSearchQueryDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SEARCH_QUERY_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const noResults = source.match(/^لا توجد نتائج لـ «(.+)»$/u)
  if (noResults?.[1]) return templates.noResults(noResults[1])
  const modeNoResults = source.match(/^لم ينتج النمط المختار مواضع لعبارة «(.+)»\.$/u)
  return modeNoResults?.[1] ? templates.modeNoResults(modeNoResults[1]) : undefined
}

function translateSearchCoverageDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SEARCH_COVERAGE_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const unavailableEmpty = source.match(/^تعذّر البحث في\s+([0-9٠-٩]+)\s+كتاب؛ لا يمكن الجزم بعدم وجود نتائج حتى تكتمل الفهارس\.$/u)
  if (unavailableEmpty?.[1]) return templates.unavailableEmpty(unavailableEmpty[1])
  const unavailablePartial = source.match(/^نتائج جزئية: تعذّر البحث في\s+([0-9٠-٩]+)\s+كتاب، وما يظهر أدناه من الكتب التي اكتمل فهرسها\.$/u)
  if (unavailablePartial?.[1]) return templates.unavailablePartial(unavailablePartial[1])
  const pending = source.match(/^نتائج أولية سريعة؛ بقي\s+([0-9٠-٩]+)\s+كتابًا لاستكمال التغطية\.$/u)
  return pending?.[1] ? templates.pending(pending[1]) : undefined
}

function translateSearchFilterDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SEARCH_FILTER_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const removeFilter = source.match(/^إزالة مرشح\s+(.+)$/u)
  if (removeFilter?.[1]) return templates.removeFilter(removeFilter[1])
  const book = source.match(/^الكتاب:\s+(.+)$/u)
  if (book?.[1]) return templates.book(book[1])
  const author = source.match(/^المؤلف:\s+(.+)$/u)
  if (author?.[1]) return templates.author(author[1])
  const category = source.match(/^التصنيف:\s+(.+)$/u)
  if (category?.[1]) return templates.category(category[1])
  const deathFrom = source.match(/^الوفاة من\s+([0-9٠-٩]+)\s+هـ$/u)
  if (deathFrom?.[1]) return templates.deathFrom(deathFrom[1])
  const deathTo = source.match(/^الوفاة إلى\s+([0-9٠-٩]+)\s+هـ$/u)
  return deathTo?.[1] ? templates.deathTo(deathTo[1]) : undefined
}

function translateSettingsArchivePreviewDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_SETTINGS_ARCHIVE_PREVIEW_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const preview = source.match(/^المعاينة:\s+([0-9٠-٩]+)\s+كتاب، منها\s+([0-9٠-٩]+)\s+متعارض\.( ستُستبدل الكتب المتعارضة بمعاملة مستقلة لكل كتاب\.)? لا تُستورد بيانات القراءة من هذا ZIP\. متابعة؟$/u)
  return preview?.[1] && preview[2] ? templates.preview(preview[1], preview[2], Boolean(preview[3])) : undefined
}

function translateMeAccountBookDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_ME_ACCOUNT_BOOK_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const confirmation = source.match(/^حذف «(.+)» من حسابك؟$/u)
  if (confirmation?.[1]) return templates.confirmDelete(confirmation[1])
  const deleteLabel = source.match(/^حذف\s+(.+)$/u)
  return deleteLabel?.[1] ? templates.deleteLabel(deleteLabel[1]) : undefined
}

function translateReaderSearchDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_READER_SEARCH_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const resultLabel = source.match(/^النتيجة\s+([0-9٠-٩]+)،\s+صفحة\s+([0-9٠-٩]+)،\s+([\s\S]+)$/u)
  if (resultLabel?.[1] && resultLabel[2] && resultLabel[3]) return templates.resultLabel(resultLabel[1], resultLabel[2], resultLabel[3])
  const progress = source.match(/^([0-9٠-٩]+)\s+من\s+([0-9٠-٩]+)$/u)
  if (progress?.[1] && progress[2]) return templates.progress(progress[1], progress[2])
  const results = source.match(/^([0-9٠-٩]+)\s+نتيجة$/u)
  if (results?.[1]) return templates.results(results[1])
  const page = source.match(/^صفحة\s+([0-9٠-٩]+)$/u)
  return page?.[1] ? templates.page(page[1]) : undefined
}

function translateLibraryBulkDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_LIBRARY_BULK_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const selected = source.match(/^اخترت\s+(.+?)\s+كتاب؛ لا تتغير إلا الحقول التي حددتها هنا$/u)
  if (selected?.[1]) return templates.selected(selected[1])
  const apply = source.match(/^تطبيق التغييرات على\s+(.+?)\s+كتاب$/u)
  if (apply?.[1]) return templates.apply(apply[1])
  const applied = source.match(/^طُبقت البيانات المحددة على\s+(.+?)\s+كتاب$/u)
  if (applied?.[1]) return templates.applied(applied[1])
  const undone = source.match(/^تراجعت عن آخر تطبيق جماعي على\s+(.+?)\s+كتاب$/u)
  if (undone?.[1]) return templates.undone(undone[1])
  const confirmDelete = source.match(/^حذف\s+(.+?)\s+كتاب؟\s+([\s\S]+)\s+لا يمكن التراجع عن هذا الحذف\.$/u)
  if (confirmDelete?.[1] && confirmDelete[2]) return templates.confirmDelete(confirmDelete[1], confirmDelete[2])
  const deletedWithFailures = source.match(/^حُذف\s+(.+?)\s+وتعذر حذف\s+(.+)$/u)
  if (deletedWithFailures?.[1] && deletedWithFailures[2]) return templates.deletedWithFailures(deletedWithFailures[1], deletedWithFailures[2])
  const deleted = source.match(/^حُذف\s+(.+?)\s+كتاب$/u)
  return deleted?.[1] ? templates.deleted(deleted[1]) : undefined
}

function translateMeSummaryDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_ME_SUMMARY_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const sessionIdentity = source.match(/^أنت داخل بصفة\s+([\s\S]+)\s+لهذه الجلسة$/u)
  if (sessionIdentity?.[1]) return templates.sessionIdentity(sessionIdentity[1])
  const identity = source.match(/^أنت داخل بصفة\s+([\s\S]+)$/u)
  if (identity?.[1]) return templates.identity(identity[1])
  const ratio = source.match(/^([0-9٠-٩٬,]+)\s+من\s+([0-9٠-٩٬,]+)$/u)
  if (ratio?.[1] && ratio[2]) return templates.ratio(ratio[1], ratio[2])
  const activePlan = source.match(/^([0-9٠-٩٬,]+)\s+(خطة فعّالة|خطط فعّالة)$/u)
  if (activePlan?.[1] && activePlan[2]) return templates.activePlan(activePlan[1], activePlan[2] === 'خطة فعّالة')
  const annotations = source.match(/^([0-9٠-٩٬,]+)\s+علامة ·\s+([0-9٠-٩٬,]+)\s+ملاحظة ·\s+([0-9٠-٩٬,]+)\s+تظليل$/u)
  if (annotations?.[1] && annotations[2] && annotations[3]) return templates.annotations(annotations[1], annotations[2], annotations[3])
  const activeDays = source.match(/^([0-9٠-٩٬,]+)\s+يومًا نشطًا$/u)
  if (activeDays?.[1]) return templates.activeDays(activeDays[1])
  const bookOpens = source.match(/^([0-9٠-٩٬,]+)\s+فتحة كتاب$/u)
  if (bookOpens?.[1]) return templates.bookOpens(bookOpens[1])
  const completion = source.match(/^([0-9٠-٩٬,]+)٪ من الأيام$/u)
  if (completion?.[1]) return templates.completion(completion[1])
  const heatmap = source.match(/^([0-9٠-٩٬,]+)\s+يوم قراءة من آخر\s+([0-9٠-٩٬,]+)\s+يومًا$/u)
  return heatmap?.[1] && heatmap[2] ? templates.heatmap(heatmap[1], heatmap[2]) : undefined
}

function translateReaderDocumentAriaDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_READER_DOCUMENT_ARIA_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const pdfPage = source.match(/^صفحة PDF\s+([0-9٠-٩٬,]+)\s+من\s+([0-9٠-٩٬,]+)$/u)
  if (pdfPage?.[1] && pdfPage[2]) return templates.pdfPage(pdfPage[1], pdfPage[2])
  const textPage = source.match(/^صفحة نصية\s+([0-9٠-٩٬,]+)$/u)
  if (textPage?.[1]) return templates.textPage(textPage[1])
  const titlePage = source.match(/^صفحة عنوان\s+([\s\S]+)$/u)
  if (titlePage?.[1]) return templates.titlePage(titlePage[1])
  const pdfPages = source.match(/^صفحات PDF من\s+([\s\S]+)$/u)
  if (pdfPages?.[1]) return templates.pdfPages(pdfPages[1])
  const originalCopy = source.match(/^النسخة الأصلية من\s+([\s\S]+)$/u)
  return originalCopy?.[1] ? templates.originalCopy(originalCopy[1]) : undefined
}

function translateReaderStatusDynamic(source: string, language: string): string | undefined {
  const templates = REVIEWED_READER_STATUS_DYNAMIC_TEMPLATES[language]
  if (!templates) return undefined
  const preservedWithDiagnostic = source.match(/^بيانات الكتاب الأصلية محفوظة ولم تُحذف\. رمز التشخيص:\s+([\s\S]+)$/u)
  if (preservedWithDiagnostic?.[1]) return templates.preservedWithDiagnostic(preservedWithDiagnostic[1])
  const diagnostic = source.match(/^رمز التشخيص:\s+([\s\S]+)$/u)
  if (diagnostic?.[1]) return templates.diagnostic(diagnostic[1])
  const copyFailed = source.match(/^تعذّر النسخ:\s+([\s\S]+)$/u)
  if (copyFailed?.[1]) return templates.copyFailed(copyFailed[1])
  const pdfFailed = source.match(/^تعذّر إنشاء PDF:\s+([\s\S]+)$/u)
  if (pdfFailed?.[1]) return templates.pdfFailed(pdfFailed[1])
  const partsDownload = source.match(/^بدأ تنزيل\s+([0-9٠-٩٬,]+)\s+أجزاء بصيغها الأصلية$/u)
  if (partsDownload?.[1]) return templates.partsDownload(partsDownload[1])
  const localRequired = source.match(/^([\s\S]+) — يتطلب التطبيق المحلي$/u)
  return localRequired?.[1] ? templates.localRequired(localRequired[1]) : undefined
}

export function translateUiLabel(source: string, language: string): string | undefined {
  const exact = UI_TRANSLATIONS[language]?.[source]
  if (exact) return exact
  const featureItemCount = translateFeatureItemCount(source, language)
  if (featureItemCount) return featureItemCount
  const quotePosition = /^موضع ([0-9٠-٩۰-۹]+)$/u.exec(source)
  const positionTemplate = UI_TRANSLATIONS[language]?.['موضع {n}']
  if (quotePosition && positionTemplate) return positionTemplate.replace('{n}', quotePosition[1]!)
  const statisticsSnapshot = translateStatisticsSnapshot(source, language)
  if (statisticsSnapshot) return statisticsSnapshot
  const accountGreeting = translateAccountGreeting(source, language)
  if (accountGreeting) return accountGreeting
  const bookCount = translateBookCount(source, language)
  if (bookCount) return bookCount
  const openedCount = translateOpenedCount(source, language)
  if (openedCount) return openedCount
  const readingProgress = translateReadingProgress(source, language)
  if (readingProgress) return readingProgress
  const readingPlanProgress = translateReadingPlanProgress(source, language)
  if (readingPlanProgress) return readingPlanProgress
  const researchDynamic = translateResearchDynamic(source, language)
  if (researchDynamic) return researchDynamic
  const settingsDynamic = translateSettingsDynamic(source, language)
  if (settingsDynamic) return settingsDynamic
  const editionsSeriesDynamic = translateEditionsSeriesDynamic(source, language)
  if (editionsSeriesDynamic) return editionsSeriesDynamic
  const shelvesDynamic = translateShelvesDynamic(source, language)
  if (shelvesDynamic) return shelvesDynamic
  const adminQualityDynamic = translateAdminQualityDynamic(source, language)
  if (adminQualityDynamic) return adminQualityDynamic
  const newBooksDynamic = translateNewBooksDynamic(source, language)
  if (newBooksDynamic) return newBooksDynamic
  const notesDynamic = translateNotesDynamic(source, language)
  if (notesDynamic) return notesDynamic
  const bookPreviewDynamic = translateBookPreviewDynamic(source, language)
  if (bookPreviewDynamic) return bookPreviewDynamic
  const searchDynamic = translateSearchDynamic(source, language)
  if (searchDynamic) return searchDynamic
  const bookReadingPlanDynamic = translateBookReadingPlanDynamic(source, language)
  if (bookReadingPlanDynamic) return bookReadingPlanDynamic
  const bookMetadataDynamic = translateBookMetadataDynamic(source, language)
  if (bookMetadataDynamic) return bookMetadataDynamic
  const adminBookFieldsDynamic = translateAdminBookFieldsDynamic(source, language)
  if (adminBookFieldsDynamic) return adminBookFieldsDynamic
  const searchQueryDynamic = translateSearchQueryDynamic(source, language)
  if (searchQueryDynamic) return searchQueryDynamic
  const searchCoverageDynamic = translateSearchCoverageDynamic(source, language)
  if (searchCoverageDynamic) return searchCoverageDynamic
  const searchFilterDynamic = translateSearchFilterDynamic(source, language)
  if (searchFilterDynamic) return searchFilterDynamic
  const settingsArchivePreviewDynamic = translateSettingsArchivePreviewDynamic(source, language)
  if (settingsArchivePreviewDynamic) return settingsArchivePreviewDynamic
  const libraryBulkDynamic = translateLibraryBulkDynamic(source, language)
  if (libraryBulkDynamic) return libraryBulkDynamic
  const meSummaryDynamic = translateMeSummaryDynamic(source, language)
  if (meSummaryDynamic) return meSummaryDynamic
  const readerDocumentAriaDynamic = translateReaderDocumentAriaDynamic(source, language)
  if (readerDocumentAriaDynamic) return readerDocumentAriaDynamic
  const readerStatusDynamic = translateReaderStatusDynamic(source, language)
  if (readerStatusDynamic) return readerStatusDynamic
  const meAccountBookDynamic = translateMeAccountBookDynamic(source, language)
  if (meAccountBookDynamic) return meAccountBookDynamic
  const readerSearchDynamic = translateReaderSearchDynamic(source, language)
  if (readerSearchDynamic) return readerSearchDynamic
  const readerTocDynamic = translateReaderTocDynamic(source, language)
  if (readerTocDynamic) return readerTocDynamic
  const readerAnnotationsDynamic = translateReaderAnnotationsDynamic(source, language)
  if (readerAnnotationsDynamic) return readerAnnotationsDynamic
  const readerAnnotationNavigation = translateReaderAnnotationNavigation(source, language)
  if (readerAnnotationNavigation) return readerAnnotationNavigation
  const bookImportReviewDynamic = translateBookImportReviewDynamic(source, language)
  if (bookImportReviewDynamic) return bookImportReviewDynamic
  const bookImportProgress = translateBookImportProgress(source, language)
  if (bookImportProgress) return bookImportProgress
  if (['ckb', 'ku', 'tr', 'ur', 'fa'].includes(language)) {
    const day = source.match(/^الجديد يوم\s+(.+)$/u)
    if (day) return ({
      ckb: `نوێی ڕۆژی ${day[1]}`, ku: `Nû yên roja ${day[1]}`, tr: `${day[1]} tarihindeki yeniler`,
      ur: `${day[1]} کے دن کی نئی کتب`, fa: `تازه‌های روز ${day[1]}`,
    } as Record<string, string>)[language]
    const shown = source.match(/^عُرض\s+([0-9٠-٩]+)\s+من\s+([0-9٠-٩]+)\s+كتابًا\s+—\s+تابع النزول$/u)
    if (shown) return ({
      ckb: `${shown[1]} لە ${shown[2]} کتێب نیشان درا — بەرەو خوارەوە بەردەوام بە`,
      ku: `${shown[1]} ji ${shown[2]} pirtûkan hatin nîşandan — ber bi jêr ve bidomîne`,
      tr: `${shown[2]} kitaptan ${shown[1]} tanesi gösterildi — aşağı inmeye devam edin`,
      ur: `${shown[2]} میں سے ${shown[1]} کتابیں دکھائی گئیں — نیچے جاتے رہیں`,
      fa: `${shown[1]} از ${shown[2]} کتاب نمایش داده شد — به پایین‌رفتن ادامه دهید`,
    } as Record<string, string>)[language]
    const complete = source.match(/^اكتملت الكتب الجديدة:\s+([0-9٠-٩]+)\s+كتابًا$/u)
    if (complete) return ({
      ckb: `هەموو ${complete[1]} کتێبە نوێیەکە نیشان دران`, ku: `Hemû ${complete[1]} pirtûkên nû hatin nîşandan`,
      tr: `${complete[1]} yeni kitabın tümü gösterildi`, ur: `تمام ${complete[1]} نئی کتابیں دکھا دی گئیں`,
      fa: `همهٔ ${complete[1]} کتاب تازه نمایش داده شد`,
    } as Record<string, string>)[language]
  }
  if (language === 'en') {
  }
  if (language === 'fr') {
  }
  return undefined
}

/** يعيد العربية الأصلية فور غياب المفتاح المحلي، بلا شبكة وبلا نص فارغ. */
export function resolveUiLabel(source: string, language: string): string {
  return language === 'ar' ? source : translateUiLabel(source, language) ?? source
}
