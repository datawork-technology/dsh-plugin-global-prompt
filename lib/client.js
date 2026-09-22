window.__ModuleLoader__.load({
	id: "dsh-plugin-global-prompt",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region css
		const css = ".gpr-row{border-bottom:1px solid var(--dsw-alias-border-l2);flex-direction:column;gap:6px;padding:16px 0;display:flex}.gpr-head{align-items:center;gap:12px;min-width:0;display:flex}.gpr-title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}.gpr-count{color:var(--dsw-alias-label-tertiary);flex:none;margin-left:auto;font-size:12px;line-height:18px}.gpr-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.gpr-input{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);width:100%;min-height:120px;color:var(--dsw-alias-label-primary);resize:vertical;border-radius:8px;margin:0;padding:8px 12px;font:inherit;font-size:13px;line-height:1.5}.gpr-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.gpr-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.gpr-status-error{color:var(--dsw-alias-state-error-primary)}.gpr-foot{align-items:center;gap:12px;display:flex}.gpr-foot .gpr-status{flex:1;min-width:0}.gpr-save{cursor:pointer;height:28px;color:var(--dsw-alias-label-primary);background:0 0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 12px;font:inherit;font-size:12px;line-height:18px}.gpr-save:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.gpr-save:disabled{cursor:default;opacity:.45}";
		const tagId = "dsh-plugin-global-prompt/GlobalPromptRow.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-global-prompt";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region lib/types/client.js
		/** Locale namespace owning this row's copy. */
		const NS = "settings.global-prompt";
		/** Settings namespace registered by the host half. */
		const SETTINGS_NAMESPACE = "global-prompt";
		/** Settings field carrying the prompt text. */
		const SETTINGS_FIELD = "text";
		/** Keep the model context bounded; mirrors the host schema's max. */
		const MAX_LENGTH = 20000;
		/** Autosave quiet window after the last keystroke. */
		const SAVE_DEBOUNCE_MS = 600;

		/** Simplified Chinese dictionary (key-set source of truth). */
		const zh = {
			"title": "全局 Prompt",
			"hint": "注入到每次对话的系统提示词中，保存后对下一条回复立即生效；留空则不注入。",
			"placeholder": "例如：始终使用中文回答；先给出结论，再解释理由……",
			"saved": "已保存",
			"saving": "保存中…",
			"unsaved": "有未保存的修改",
			"save": "保存",
			"error": "保存失败"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"title": "Global prompt",
			"hint": "Injected into the system prompt of every conversation; takes effect on the next reply after saving. Leave empty to disable.",
			"placeholder": "e.g. Always answer in Chinese; state the conclusion first, then the reasoning…",
			"saved": "Saved",
			"saving": "Saving…",
			"unsaved": "Unsaved changes",
			"save": "Save",
			"error": "Failed to save"
		};

		/**
		 * Global-prompt preference row registered into the General section item
		 * slot: title + hint + a multi-line textarea whose text lives in the row's
		 * own store, plus debounced autosave, an explicit Save button and a dirty
		 * indicator.
		 *
		 * The text is store state (not component state) on purpose: the store
		 * instance is cached per root scope by the slot renderer and outlives the
		 * Settings dialog, so closing and reopening the dialog cannot lose the
		 * text. It is also the only place the text can survive when the settings
		 * mirror is slow, silent, or reports the namespace as unavailable.
		 * @param props - composed slot props ({@link store} useStore, locale t, and
		 *   the inject face's {save, edit, commit, adoptPulled, readHostValue}).
		 * @returns the row element tree.
		 */
		function GlobalPromptRow({ t, useStore, save, edit, commit, adoptPulled, readHostValue }) {
			const raw = useStore((s) => s.value);
			const dirty = useStore((s) => s.dirty);
			const storedSaved = useStore((s) => s.saved);
			const value = typeof raw === "string" ? raw : "";
			const [status, setStatus] = react.useState("idle");
			const [error, setError] = react.useState(null);
			const pendingRef = react.useRef(null);
			const timerRef = react.useRef(null);
			const liveRef = react.useRef({ value, dirty, save, commit });
			liveRef.current = { value, dirty, save, commit };
			const savedRef = react.useRef(storedSaved);
			savedRef.current = storedSaved;

			// One direct Host read per mounting. This repairs a settings mirror that
			// never reports the namespace as ready (the saved text would otherwise be
			// invisible after a restart) and re-reads the value after the dialog was
			// closed. The adopt is revision-guarded: anything that moved while the
			// read was in flight wins over the response.
			react.useEffect(() => {
				let cancelled = false;
				if (typeof readHostValue !== "function" || typeof adoptPulled !== "function") return void 0;
				readHostValue().then((text) => {
					if (cancelled || typeof text !== "string") return;
					adoptPulled(text, savedRef.current);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, []);

			const clearTimer = () => {
				if (timerRef.current === null) return;
				clearTimeout(timerRef.current);
				timerRef.current = null;
			};

			// Write the latest text to the Host. Falls back to the store value when
			// no keystroke is pending, so the Save button still works after a remount
			// (a reopened dialog keeps `dirty` in the store but not the local ref).
			const flush = () => {
				const next = pendingRef.current !== null ? pendingRef.current : liveRef.current.value;
				if (pendingRef.current === null && liveRef.current.dirty !== true) return;
				pendingRef.current = null;
				clearTimer();
				setStatus("saving");
				setError(null);
				liveRef.current.save(next).then(() => {
					setStatus("saved");
					liveRef.current.commit(next);
				}).catch((cause) => {
					setStatus("error");
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};

			// A pending edit must survive the dialog closing: write it on unmount
			// instead of cancelling the debounce timer.
			react.useEffect(() => () => {
				const live = liveRef.current;
				if (pendingRef.current === null && live.dirty !== true) return;
				const text = pendingRef.current !== null ? pendingRef.current : live.value;
				pendingRef.current = null;
				clearTimer();
				live.save(text).then(() => live.commit(text)).catch(() => {});
			}, []);

			const handleChange = (event) => {
				const next = event.target.value;
				edit(next);
				pendingRef.current = next;
				setError(null);
				clearTimer();
				timerRef.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
			};

			const statusText = status === "error" ? t("error") : status === "saving" ? t("saving") : dirty === true ? t("unsaved") : status === "saved" ? t("saved") : "";
			const statusNode = statusText.length === 0 ? null : react_jsx_runtime.jsx("span", {
				className: "gpr-status" + (status === "error" ? " gpr-status-error" : ""),
				role: status === "error" ? "alert" : void 0,
				children: status === "error" && error !== null ? statusText + ": " + error : statusText
			});

			return react_jsx_runtime.jsxs("div", {
				className: "gpr-row",
				children: [
					react_jsx_runtime.jsxs("div", {
						className: "gpr-head",
						children: [
							react_jsx_runtime.jsx("span", { className: "gpr-title", children: t("title") }),
							react_jsx_runtime.jsx("span", { className: "gpr-count", children: String(value.length) + "/" + String(MAX_LENGTH) })
						]
					}),
					react_jsx_runtime.jsx("div", { className: "gpr-hint", children: t("hint") }),
					react_jsx_runtime.jsx("textarea", {
						className: "gpr-input",
						value,
						onChange: handleChange,
						rows: 6,
						spellCheck: false,
						maxLength: MAX_LENGTH,
						"aria-label": t("title"),
						placeholder: t("placeholder")
					}),
					react_jsx_runtime.jsxs("div", {
						className: "gpr-foot",
						children: [statusNode, react_jsx_runtime.jsx("button", {
							type: "button",
							className: "gpr-save",
							onClick: flush,
							disabled: dirty !== true || status === "saving",
							children: t("save")
						})]
					})
				]
			});
		}

		/**
		 * Row store: the row's single source of truth and the reason the text
		 * survives the Settings dialog closing. `value` is what the textarea
		 * renders, `saved` is the last confirmed write, and `dirty` marks the gap
		 * between them (which the Save button and the unsaved indicator show).
		 * @returns the store handle registered with the row.
		 */
		function createGlobalPromptStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					value: "",
					saved: "",
					dirty: false
				}),
				actions: {
					adopt: (d, text) => {
						// Never clobber an edit the user has not saved yet: any external
						// value (a mirror refresh, or a pull that raced a keystroke) loses
						// to what is on screen until it is saved.
						if (d.dirty === true) return;
						const next = typeof text === "string" ? text : "";
						d.saved = next;
						d.value = next;
						d.dirty = false;
					},
					/**
					 * Adopt a value read straight from the Host, but only when nothing
					 * local moved while that read was in flight — the response may be
					 * older than a save the user just made.
					 */
					adoptPulled: (d, text, expectedSaved) => {
						if (typeof expectedSaved !== "string" || d.saved !== expectedSaved) return;
						if (d.dirty === true) return;
						const next = typeof text === "string" ? text : "";
						d.saved = next;
						d.value = next;
						d.dirty = false;
					},
					edit: (d, text) => {
						d.value = typeof text === "string" ? text : "";
						d.dirty = d.value !== d.saved;
					},
					commit: (d, text) => {
						// Commit the text that was actually written: if the user kept
						// typing while the write was in flight, the row stays dirty.
						const written = typeof text === "string" ? text : d.value;
						d.saved = written;
						d.dirty = d.value !== written;
					}
				}
			});
		}

		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"locale",
			"remote",
			"settingsScope"
		];

		/**
		 * Register the feature-owned Global prompt preference row into the
		 * General section's item slot once the slot declaration is on the ledger.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "global-prompt: dictionaries");
			const t = ctx.locale.bind(NS);
			const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
			const store = createGlobalPromptStore();
			let bound;
			const reflect = (snapshot) => {
				if (snapshot.status !== "ready" || snapshot.value === void 0) return;
				bound?.adopt(snapshot.value[SETTINGS_FIELD]);
			};
			// Read this namespace straight from the Host. The scope mirror is the
			// primary path, but it can stay silent on the Desktop shell, and then the
			// saved value would never reach the box. Bounded and failure-tolerant:
			// any error leaves the row on its last known value.
			const readHostValue = async () => {
				try {
					const response = await ctx.remote.settings.describe();
					if (response === null || typeof response !== "object" || response.ok !== true) return void 0;
					const views = response.value === null || typeof response.value !== "object" ? void 0 : response.value.namespaces;
					if (!Array.isArray(views)) return void 0;
					const row = views.find((candidate) => candidate?.ns === SETTINGS_NAMESPACE);
					if (row === void 0) return void 0;
					const text = row.value?.[SETTINGS_FIELD];
					return typeof text === "string" ? text : void 0;
				} catch (_unavailable) {
					return void 0;
				}
			};
			ctx.effect(() => scope.subscribe(reflect), "global-prompt: settings scope adoption");
			reflect(scope.getSnapshot());
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "global-prompt",
				order: 10,
				store,
				locale: NS,
				inject: (actions) => {
					bound = actions;
					reflect(scope.getSnapshot());
					return {
						save: (text) => scope.set(SETTINGS_FIELD, text),
						edit: (text) => actions.edit(text),
						commit: (text) => actions.commit(text),
						adoptPulled: (text, expectedSaved) => actions.adoptPulled(text, expectedSaved),
						readHostValue
					};
				}
			}, GlobalPromptRow));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
