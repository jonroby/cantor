<svg
	viewBox="0 0 960 600"
	xmlns="http://www.w3.org/2000/svg"
	style="display:block;width:100%;height:auto;background:#f9f9f9;"
	font-family="Inter, system-ui, sans-serif"
>
	<defs>
		<!-- Clip to app bounds -->
		<clipPath id="app-clip">
			<rect x="0" y="0" width="960" height="600" rx="12" />
		</clipPath>

		<!-- Chat message shimmer animation -->
		<linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
			<stop offset="0%" stop-color="#f0f0f0" />
			<stop offset="50%" stop-color="#e4e4e4" />
			<stop offset="100%" stop-color="#f0f0f0" />
			<animateTransform
				attributeName="gradientTransform"
				type="translate"
				from="-200 0"
				to="200 0"
				dur="1.8s"
				repeatCount="indefinite"
			/>
		</linearGradient>

		<!-- Typing cursor blink -->
		<style>
			@keyframes blink {
				0%, 100% { opacity: 1; }
				50% { opacity: 0; }
			}
			@keyframes fadeIn {
				from { opacity: 0; transform: translateY(4px); }
				to { opacity: 1; transform: translateY(0); }
			}
			@keyframes fadeIn2 {
				0%, 30% { opacity: 0; transform: translateY(4px); }
				100% { opacity: 1; transform: translateY(0); }
			}
			@keyframes fadeIn3 {
				0%, 55% { opacity: 0; transform: translateY(4px); }
				100% { opacity: 1; transform: translateY(0); }
			}
			@keyframes fadeIn4 {
				0%, 75% { opacity: 0; transform: translateY(4px); }
				100% { opacity: 1; transform: translateY(0); }
			}
			@keyframes slideUp {
				from { opacity: 0; transform: translateY(6px); }
				to { opacity: 1; transform: translateY(0); }
			}
			@keyframes cursorBlink {
				0%, 100% { opacity: 1; }
				50% { opacity: 0; }
			}
			@keyframes streamWidth {
				0% { width: 0px; }
				100% { width: 320px; }
			}
			.msg1 { animation: fadeIn 0.4s ease 0.2s both; }
			.msg2 { animation: fadeIn2 0.4s ease 2.8s both; }
			.msg3 { animation: fadeIn3 0.4s ease 3.2s both; }
			.msg4 { animation: fadeIn4 0.4s ease 3.6s both; }
			.cursor { animation: cursorBlink 0.9s ease infinite; }
		</style>
	</defs>

	<g clip-path="url(#app-clip)">

		<!-- ── Sidebar ───────────────────────────────────────── -->
		<rect x="0" y="0" width="220" height="600" fill="#f5f5f5" />
		<!-- Sidebar right border -->
		<line x1="220" y1="0" x2="220" y2="600" stroke="#e3e3e3" stroke-width="1" />

		<!-- Sidebar header -->
		<rect x="0" y="0" width="220" height="52" fill="#f5f5f5" />

		<!-- Logo area -->
		<!-- Cantor dot logo (small) -->
		<circle cx="24" cy="20" r="3" fill="rgba(23,23,23,1)" />
		<circle cx="16" cy="28" r="3" fill="rgba(23,23,23,0.65)" />
		<circle cx="24" cy="28" r="3" fill="rgba(23,23,23,0.65)" />
		<circle cx="32" cy="28" r="3" fill="rgba(23,23,23,0.65)" />
		<circle cx="16" cy="36" r="3" fill="rgba(23,23,23,0.4)" />
		<circle cx="24" cy="36" r="3" fill="rgba(23,23,23,0.4)" />
		<circle cx="32" cy="36" r="3" fill="rgba(23,23,23,0.4)" />
		<circle cx="24" cy="44" r="3" fill="rgba(23,23,23,0.2)" />
		<text x="44" y="30" font-size="14" font-weight="600" fill="rgba(23,23,23,0.88)">Cantor</text>

		<!-- New chat button -->
		<rect x="188" y="14" width="24" height="24" rx="6" fill="rgba(23,23,23,0.06)" />
		<!-- + icon approximation -->
		<line x1="200" y1="20" x2="200" y2="32" stroke="rgba(23,23,23,0.5)" stroke-width="1.5" stroke-linecap="round"/>
		<line x1="194" y1="26" x2="206" y2="26" stroke="rgba(23,23,23,0.5)" stroke-width="1.5" stroke-linecap="round"/>

		<!-- Sidebar divider -->
		<line x1="12" y1="52" x2="208" y2="52" stroke="#e3e3e3" stroke-width="1" />

		<!-- "Chats" label -->
		<text x="16" y="76" font-size="10.5" font-weight="600" fill="rgba(23,23,23,0.38)" letter-spacing="0.6">CHATS</text>

		<!-- Chat items in sidebar -->
		<!-- Active chat -->
		<rect x="8" y="84" width="204" height="32" rx="6" fill="rgba(23,23,23,0.07)" />
		<text x="20" y="104" font-size="12.5" fill="rgba(23,23,23,0.88)" font-weight="500">Refactor auth module</text>

		<!-- Other chats -->
		<text x="20" y="136" font-size="12.5" fill="rgba(23,23,23,0.55)">Build a REST API</text>
		<text x="20" y="162" font-size="12.5" fill="rgba(23,23,23,0.55)">Data pipeline design</text>
		<text x="20" y="188" font-size="12.5" fill="rgba(23,23,23,0.55)">Explain transformers</text>
		<text x="20" y="214" font-size="12.5" fill="rgba(23,23,23,0.55)">Write unit tests for...</text>
		<text x="20" y="240" font-size="12.5" fill="rgba(23,23,23,0.55)">Docker compose setup</text>
		<text x="20" y="266" font-size="12.5" fill="rgba(23,23,23,0.55)">Optimize SQL queries</text>

		<!-- Folder section -->
		<line x1="12" y1="292" x2="208" y2="292" stroke="#e3e3e3" stroke-width="1" />
		<text x="16" y="314" font-size="10.5" font-weight="600" fill="rgba(23,23,23,0.38)" letter-spacing="0.6">DOCUMENTS</text>

		<!-- Folder items -->
		<!-- Folder icon (triangle) -->
		<polygon points="20,328 26,328 23,334" fill="rgba(23,23,23,0.45)" />
		<text x="30" y="336" font-size="12.5" fill="rgba(23,23,23,0.55)">Research</text>

		<polygon points="20,354 26,354 23,360" fill="rgba(23,23,23,0.45)" />
		<text x="30" y="362" font-size="12.5" fill="rgba(23,23,23,0.55)">Project Notes</text>


		<!-- ── Main area ─────────────────────────────────────── -->
		<rect x="220" y="0" width="740" height="600" fill="#ffffff" />

		<!-- Chat panel header -->
		<rect x="220" y="0" width="740" height="52" fill="#fafafa" />
		<line x1="220" y1="52" x2="960" y2="52" stroke="#e8e8e8" stroke-width="1" />
		<text x="244" y="30" font-size="13" font-weight="600" fill="rgba(23,23,23,0.8)">Refactor auth module</text>

		<!-- Header actions (right side) -->
		<!-- Small icon buttons -->
		<rect x="876" y="14" width="26" height="26" rx="6" fill="rgba(23,23,23,0.05)" />
		<rect x="908" y="14" width="26" height="26" rx="6" fill="rgba(23,23,23,0.05)" />
		<!-- branch icon lines -->
		<line x1="882" y1="20" x2="882" y2="28" stroke="rgba(23,23,23,0.4)" stroke-width="1.4" stroke-linecap="round"/>
		<line x1="882" y1="28" x2="888" y2="32" stroke="rgba(23,23,23,0.4)" stroke-width="1.4" stroke-linecap="round"/>
		<line x1="888" y1="32" x2="888" y2="36" stroke="rgba(23,23,23,0.4)" stroke-width="1.4" stroke-linecap="round"/>
		<!-- dots icon -->
		<circle cx="918" cy="25" r="1.5" fill="rgba(23,23,23,0.4)" />
		<circle cx="922" cy="25" r="1.5" fill="rgba(23,23,23,0.4)" />
		<circle cx="926" cy="25" r="1.5" fill="rgba(23,23,23,0.4)" />

		<!-- ── Chat messages ──────────────────────────────────── -->

		<!-- User message 1 -->
		<g class="msg1">
			<rect x="490" y="72" width="426" height="66" rx="10" fill="#1f1f1f" />
			<text x="506" y="96" font-size="12.5" fill="rgba(255,255,255,0.9)" font-weight="500">Can you help me refactor the auth</text>
			<text x="506" y="114" font-size="12.5" fill="rgba(255,255,255,0.9)" font-weight="500">middleware to use JWT tokens?</text>
			<text x="506" y="130" font-size="11" fill="rgba(255,255,255,0.4)">You · now</text>
		</g>

		<!-- Assistant response 1 - streaming in -->
		<g class="msg2">
			<text x="244" y="172" font-size="12.5" fill="rgba(23,23,23,0.88)">Sure! Here's a refactored version using JWT:</text>
		</g>
		<g class="msg3">
			<!-- Code block -->
			<rect x="244" y="182" width="380" height="96" rx="8" fill="#f5f5f5" />
			<rect x="244" y="182" width="380" height="26" rx="8" fill="#ececec" />
			<rect x="244" y="196" width="380" height="12" rx="0" fill="#ececec" />
			<text x="260" y="197" font-size="10.5" fill="rgba(23,23,23,0.45)">typescript</text>
			<text x="260" y="222" font-size="11" fill="#6366f1" font-family="ui-monospace, monospace">import</text>
			<text x="304" y="222" font-size="11" fill="rgba(23,23,23,0.75)" font-family="ui-monospace, monospace">&#123; verify &#125;</text>
			<text x="368" y="222" font-size="11" fill="#6366f1" font-family="ui-monospace, monospace">from</text>
			<text x="397" y="222" font-size="11" fill="#16a34a" font-family="ui-monospace, monospace">'jsonwebtoken'</text>
			<text x="260" y="240" font-size="11" fill="#6366f1" font-family="ui-monospace, monospace">export</text>
			<text x="304" y="240" font-size="11" fill="#6366f1" font-family="ui-monospace, monospace">async function</text>
			<text x="400" y="240" font-size="11" fill="#0ea5e9" font-family="ui-monospace, monospace">authMiddleware</text>
			<text x="260" y="258" font-size="11" fill="rgba(23,23,23,0.5)" font-family="ui-monospace, monospace">  const token = req.headers.authorization</text>
			<text x="260" y="272" font-size="11" fill="rgba(23,23,23,0.5)" font-family="ui-monospace, monospace">  const decoded = verify(token, secret)</text>
		</g>

		<!-- Streaming text line being typed -->
		<g class="msg4">
			<text x="244" y="302" font-size="12.5" fill="rgba(23,23,23,0.88)">This approach validates the token on each</text>
			<text x="244" y="320" font-size="12.5" fill="rgba(23,23,23,0.88)">request and attaches the user payload to</text>
			<rect x="244" y="327" width="196" height="12" rx="2" fill="rgba(23,23,23,0.06)" />
			<!-- Typing cursor -->
			<rect x="446" y="328" width="2" height="11" rx="1" fill="rgba(23,23,23,0.7)" class="cursor" />
		</g>

		<!-- ── Composer ───────────────────────────────────────── -->
		<!-- Composer container -->
		<rect x="260" y="494" width="680" height="86" rx="12" fill="#ffffff" stroke="#e3e3e3" stroke-width="1"
			filter="drop-shadow(0 4px 16px rgba(0,0,0,0.06))"
		/>

		<!-- Composer placeholder text -->
		<text x="280" y="526" font-size="13" fill="rgba(23,23,23,0.3)">Message Cantor...</text>

		<!-- Composer bottom bar -->
		<line x1="276" y1="544" x2="924" y2="544" stroke="#e8e8e8" stroke-width="1" />

		<!-- Model selector pill -->
		<rect x="280" y="552" width="90" height="22" rx="11" fill="rgba(23,23,23,0.06)" />
		<text x="292" y="567" font-size="11" fill="rgba(23,23,23,0.55)" font-weight="500">claude-4</text>

		<!-- Agent toggle -->
		<rect x="380" y="552" width="60" height="22" rx="11" fill="rgba(23,23,23,0.06)" />
		<text x="394" y="567" font-size="11" fill="rgba(23,23,23,0.55)" font-weight="500">Agent</text>

		<!-- Send button -->
		<rect x="894" y="552" width="22" height="22" rx="11" fill="#1f1f1f" />
		<polygon points="899,567 905,560 911,567" fill="white" />

	</g>
</svg>
