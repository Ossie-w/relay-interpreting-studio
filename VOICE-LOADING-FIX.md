# Natural voice configuration loading repair

The pinned Kokoro runtime probes tokenizer_config.json using a ranged GET.
If metadata probing fails, its tokenizer file list is empty and it dereferences
an undefined configuration's tokenizer_class. A cold browser can therefore fail
even when a browser with cached metadata worked.

The site's worker now serves the three small, validated upstream JSON configs
from the site's own origin for both probing and full reads. Invalid responses
retry once, then name the failed file. Existing weights and audio caches are
preserved; the public model identifier and voice quality are unchanged.

Validation: six focused tests passed, including blocked remote configuration,
invalid-response retry, persistent failure, and untouched weight requests.
A new headless Chrome context downloaded the real 339,369,442-byte model and
generated audible English (3.3s, peak .271) and Mandarin (3.7s, peak .420).
After reload it reused identical saved audio and synthesized a new English
sentence from saved weights without another network weight request.

This is a browser-only system: first use still requires access to jsDelivr and
Hugging Face for runtime, weights and voice assets. No visitor account is needed
for these public downloads, but unrestricted access in every region/network
cannot be guaranteed. This repair does not add a hosted synthesis server.
