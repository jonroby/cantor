import { type ChatTree, type Exchange } from '@/domain';
import type { Provider } from '@/domain';

function exchange(
	id: string,
	parentId: string | null,
	prompt: string,
	response: string,
	childIds: string[],
	opts: { promptTokens?: number; responseTokens?: number; model?: string; provider?: Provider } = {}
): Exchange {
	return {
		id,
		parentId,
		childIds,
		prompt: { text: prompt, tokenCount: opts.promptTokens ?? 0 },
		response: { text: response, tokenCount: opts.responseTokens ?? 0 },
		model: opts.model ?? 'claude-haiku-4-5',
		provider: opts.provider ?? 'claude',
		createdAt: Date.now()
	};
}

export function buildInitialExchanges(): ChatTree {
	const exchanges: Record<string, Exchange> = {};

	// ── Exchange 1: Attention mechanism overview ──────────────────────────────
	exchanges['1'] = exchange(
		'1',
		null,
		"[1] Can you explain how the attention mechanism works in transformers? I understand it has something to do with queries, keys, and values, but I'm fuzzy on the math.",
		`Attention is the core innovation that makes transformers so powerful. Let me build it up from first principles.

**The intuition**

When you read the word "bank" in "I deposited money at the bank," your brain attends to "money" and "deposited" to resolve the ambiguity. Attention lets a model do the same thing — dynamically weight how much each token should influence each other token.

**Scaled dot-product attention**

Given an input sequence, we project each token embedding into three vectors using learned weight matrices:

$$
Q = XW^Q, \\quad K = XW^K, \\quad V = XW^V
$$

where $X \\in \\mathbb{R}^{n \\times d_{\\text{model}}}$ is the sequence of token embeddings, and $W^Q, W^K, W^V \\in \\mathbb{R}^{d_{\\text{model}} \\times d_k}$ are the projection weights.

The attention output is then:

$$
\\text{Attention}(Q, K, V) = \\text{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$

Breaking this down step by step:

1. **Compatibility scores** — $QK^\\top \\in \\mathbb{R}^{n \\times n}$ gives a raw score for every query–key pair. Entry $(i, j)$ measures how relevant token $j$ is when processing token $i$.

2. **Scaling by $\\sqrt{d_k}$** — Without this, dot products grow large in magnitude as $d_k$ increases, pushing softmax into regions with vanishing gradients. Dividing by $\\sqrt{d_k}$ keeps the variance of the dot products near 1.

3. **Softmax** — Converts scores into a probability distribution over positions. Row $i$ now sums to 1 and represents "how much should token $i$ attend to each other token?"

4. **Weighted sum of values** — Multiplying by $V$ produces a new representation for each token: a convex combination of value vectors, weighted by attention.

**Multi-head attention**

Rather than running attention once with $d_{\\text{model}}$-dimensional projections, we run $h$ heads in parallel with smaller $d_k = d_{\\text{model}}/h$:

$$
\\text{MultiHead}(Q,K,V) = \\text{Concat}(\\text{head}_1, \\ldots, \\text{head}_h)\\,W^O
$$

$$
\\text{head}_i = \\text{Attention}(QW^Q_i,\\, KW^K_i,\\, VW^V_i)
$$

Each head can learn to attend to different kinds of relationships simultaneously — one head might track syntactic dependencies, another coreference, another positional proximity.

**Complexity**

The $QK^\\top$ product is $O(n^2 d_k)$ in time and $O(n^2)$ in memory, which is why long-context transformers are expensive. Techniques like sparse attention, linear attention, and FlashAttention all try to tame this quadratic cost.`,
		['1.1', '1.2', '1.3'],
		{ promptTokens: 42, responseTokens: 380 }
	);

	// ── Exchange 1.1: Why sqrt(d_k)? ─────────────────────────────────────────
	exchanges['1.1'] = exchange(
		'1.1',
		'1',
		'[1.1] Why exactly does dividing by √d_k prevent vanishing gradients? Can you show the variance calculation?',
		`Good question — the argument is a straightforward variance calculation.

**Setup**

Assume the components of $q$ and $k$ are i.i.d. with mean 0 and variance 1:

$$
q_i, k_i \\overset{\\text{iid}}{\\sim} (\\mu=0,\\, \\sigma^2=1)
$$

The raw dot product is:

$$
q \\cdot k = \\sum_{i=1}^{d_k} q_i k_i
$$

**Computing the variance**

Since $q_i$ and $k_i$ are independent and zero-mean:

$$
\\mathbb{E}[q_i k_i] = \\mathbb{E}[q_i]\\,\\mathbb{E}[k_i] = 0
$$

$$
\\text{Var}(q_i k_i) = \\mathbb{E}[q_i^2 k_i^2] - (\\mathbb{E}[q_i k_i])^2 = \\mathbb{E}[q_i^2]\\,\\mathbb{E}[k_i^2] = 1 \\cdot 1 = 1
$$

By independence across $i$:

$$
\\text{Var}\\!\\left(\\sum_{i=1}^{d_k} q_i k_i\\right) = \\sum_{i=1}^{d_k} \\text{Var}(q_i k_i) = d_k
$$

So the standard deviation of the dot product is $\\sqrt{d_k}$.

**The softmax problem**

Softmax is:

$$
\\text{softmax}(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}
$$

Its gradient w.r.t. $z_i$ is $p_i(1 - p_i)$, which goes to zero when $p_i \\to 0$ or $p_i \\to 1$. When one score dominates all others (as happens with large-magnitude inputs), softmax saturates — almost all weight goes to one position, and gradients nearly vanish everywhere else.

With $d_k = 64$, unscaled dot products have std $8$. Inputs of magnitude $\\pm 8$ push softmax firmly into saturation. Dividing by $\\sqrt{64} = 8$ restores std to 1, keeping softmax in its well-conditioned regime.

**After scaling**

$$
\\text{Var}\\!\\left(\\frac{q \\cdot k}{\\sqrt{d_k}}\\right) = \\frac{\\text{Var}(q \\cdot k)}{d_k} = \\frac{d_k}{d_k} = 1
$$

The variance is now independent of $d_k$, so you can scale up the model without softmax behavior degrading.`,
		['1.1.1'],
		{ promptTokens: 464, responseTokens: 312 }
	);

	// ── Exchange 1.1.1: Softmax temperature ──────────────────────────────────
	exchanges['1.1.1'] = exchange(
		'1.1.1',
		'1.1',
		'[1.1.1] So the 1/√d_k is essentially a temperature parameter? How does temperature affect a distribution generally?',
		`Exactly right — $1/\\sqrt{d_k}$ is a fixed temperature, and the connection to the general temperature concept is clean.

**Temperature-scaled softmax**

$$
\\text{softmax}(z/T)_i = \\frac{e^{z_i/T}}{\\sum_j e^{z_j/T}}
$$

The temperature $T > 0$ controls the "peakiness" of the distribution.

**Low temperature ($T \\to 0$)**

As $T \\to 0$, $z_i/T \\to \\pm\\infty$ for any nonzero differences in $z$. The distribution converges to a point mass on the argmax:

$$
\\lim_{T \\to 0} \\text{softmax}(z/T) = \\mathbf{e}_{\\arg\\max_i z_i}
$$

This is "hard" or greedy selection. In the attention context, low temperature means attending sharply to one token.

**High temperature ($T \\to \\infty$)**

As $T \\to \\infty$, all $z_i/T \\to 0$, so $e^{z_i/T} \\to 1$ for all $i$. The distribution approaches uniform:

$$
\\lim_{T \\to \\infty} \\text{softmax}(z/T) = \\text{Uniform}(n)
$$

**Information-theoretic view**

The entropy of the distribution $H = -\\sum_i p_i \\log p_i$ increases monotonically with $T$:

- $T \\to 0$: $H \\to 0$ (maximum certainty)
- $T \\to \\infty$: $H \\to \\log n$ (maximum uncertainty, uniform)

**In language model sampling**

When sampling from a language model's output distribution, temperature $T > 1$ makes the model more "creative" (flatter distribution, less predictable), while $T < 1$ makes it more "conservative" (sharper, closer to greedy). Setting $T = 1$ recovers the raw model probabilities.

The $1/\\sqrt{d_k}$ scaling in attention is equivalent to setting $T = \\sqrt{d_k}$, which grows with model dimension — a deliberate choice to keep attention diffuse enough to learn well early in training.`,
		[],
		{ promptTokens: 818, responseTokens: 290 }
	);

	// ── Exchange 1.2: Positional encodings ───────────────────────────────────
	exchanges['1.2'] = exchange(
		'1.2',
		'1',
		'[1.2] Attention is permutation-invariant, right? So how do transformers know about token order?',
		`Correct — raw attention has no notion of position. If you shuffle the tokens, the attention scores change (because different tokens are now in Q and K), but there's no structural awareness of *which position came first*. Positional encodings inject that information.

**Sinusoidal encodings (original "Attention Is All You Need")**

The position $pos \\in \\{0, 1, \\ldots, n-1\\}$ and dimension $i \\in \\{0, 1, \\ldots, d_{\\text{model}}-1\\}$ determine the encoding:

$$
PE_{(pos,\\,2i)} = \\sin\\!\\left(\\frac{pos}{10000^{2i/d_{\\text{model}}}}\\right)
$$

$$
PE_{(pos,\\,2i+1)} = \\cos\\!\\left(\\frac{pos}{10000^{2i/d_{\\text{model}}}}\\right)
$$

The wavelength for dimension pair $i$ is $\\lambda_i = 2\\pi \\cdot 10000^{2i/d_{\\text{model}}}$, forming a geometric sequence from $2\\pi$ to $2\\pi \\cdot 10000$. Low dimensions oscillate rapidly (track nearby positions); high dimensions oscillate slowly (track global position).

**Why sinusoids?**

A key property: the encoding of position $pos + k$ can be expressed as a *linear transformation* of the encoding at $pos$:

$$
\\begin{pmatrix} \\sin(\\omega(pos+k)) \\\\ \\cos(\\omega(pos+k)) \\end{pmatrix} = \\begin{pmatrix} \\cos(\\omega k) & \\sin(\\omega k) \\\\ -\\sin(\\omega k) & \\cos(\\omega k) \\end{pmatrix} \\begin{pmatrix} \\sin(\\omega pos) \\\\ \\cos(\\omega pos) \\end{pmatrix}
$$

This rotation matrix $R(\\omega k)$ is independent of $pos$, so the model can learn relative offsets without having seen every absolute position during training.

**Learned vs. sinusoidal**

Most modern transformers (GPT, BERT) use *learned* absolute position embeddings — a simple lookup table $E_{\\text{pos}} \\in \\mathbb{R}^{n_{\\text{max}} \\times d_{\\text{model}}}$. These are more flexible but don't generalize beyond the training context length.

**Rotary Position Embedding (RoPE)**

RoPE (used in LLaMA, GPT-NeoX) applies the rotation directly to Q and K before the dot product, so relative position is encoded in the compatibility score itself:

$$
\\langle R(\\theta_m) q,\\, R(\\theta_n) k \\rangle = \\langle q,\\, R(\\theta_n - \\theta_m) k \\rangle
$$

This gives the model access to relative positions $(m - n)$ in a way that's compatible with length extrapolation.`,
		['1.2.1'],
		{ promptTokens: 464, responseTokens: 340 }
	);

	// ── Exchange 1.2.1: RoPE details ──────────────────────────────────────────
	exchanges['1.2.1'] = exchange(
		'1.2.1',
		'1.2',
		'[1.2.1] Can you expand on RoPE? What does applying a rotation to Q and K actually look like in practice?',
		`RoPE is elegant once you see it in 2D, then the generalization to higher dimensions follows naturally.

**2D case**

For a 2D query vector $q = (q_1, q_2)^\\top$ at position $m$, RoPE multiplies by a rotation matrix:

$$
R(m\\theta)\\,q = \\begin{pmatrix} \\cos m\\theta & -\\sin m\\theta \\\\ \\sin m\\theta & \\cos m\\theta \\end{pmatrix} \\begin{pmatrix} q_1 \\\\ q_2 \\end{pmatrix}
$$

For key $k$ at position $n$:

$$
R(n\\theta)\\,k = \\begin{pmatrix} \\cos n\\theta & -\\sin n\\theta \\\\ \\sin n\\theta & \\cos n\\theta \\end{pmatrix} \\begin{pmatrix} k_1 \\\\ k_2 \\end{pmatrix}
$$

The dot product is:

$$
\\langle R(m\\theta)q,\\, R(n\\theta)k \\rangle = q^\\top R(m\\theta)^\\top R(n\\theta)\\, k = q^\\top R((n-m)\\theta)\\, k
$$

because $R^\\top(m\\theta) = R(-m\\theta)$ and $R(-m\\theta)R(n\\theta) = R((n-m)\\theta)$. The dot product depends only on the *relative* position $(n - m)$, not the absolute positions.

**General $d$-dimensional case**

For $d$-dimensional vectors, split them into $d/2$ pairs and rotate each pair independently:

$$
R_\\Theta(m) = \\text{blockdiag}\\bigl(R(m\\theta_1), R(m\\theta_2), \\ldots, R(m\\theta_{d/2})\\bigr)
$$

where $\\theta_i = 10000^{-2(i-1)/d}$ (matching the sinusoidal frequency schedule). In practice, this is implemented efficiently without constructing the full rotation matrix:

$$
R_\\Theta(m)\\, x = x \\odot \\cos(m\\Theta) + x' \\odot \\sin(m\\Theta)
$$

where $x' = (-x_2, x_1, -x_4, x_3, \\ldots)$ is the "rotated" version of $x$ within each pair, and $\\odot$ is elementwise multiplication.

**Why RoPE extrapolates better**

Learned absolute embeddings can only represent positions seen during training. RoPE's relative-position formulation means the model sees $(n - m)$ values, and if it learns to handle offsets up to $n_{\\text{train}}$, it has some ability to handle longer offsets — though in practice, techniques like YaRN (Yet another RoPE extensioN) further adjust the frequency schedule for long-context fine-tuning.`,
		[],
		{ promptTokens: 846, responseTokens: 358 }
	);

	// ── Exchange 1.3: Bayes' theorem in ML ────────────────────────────────────
	exchanges['1.3'] = exchange(
		'1.3',
		'1',
		"[1.3] I keep seeing Bayes' theorem come up in machine learning papers. Can you give me a thorough explanation of how it applies?",
		`Bayes' theorem is the backbone of probabilistic inference, and it shows up everywhere in ML — from naive Bayes classifiers to variational autoencoders to Bayesian neural networks. Let me build it up carefully.

**The theorem**

$$
P(H \\mid E) = \\frac{P(E \\mid H)\\, P(H)}{P(E)}
$$

In words:

| Term | Name | Meaning |
|---|---|---|
| $P(H)$ | Prior | Belief in hypothesis $H$ before seeing evidence |
| $P(E \\mid H)$ | Likelihood | How probable the evidence is if $H$ is true |
| $P(E)$ | Evidence (marginal) | Total probability of the evidence under all hypotheses |
| $P(H \\mid E)$ | Posterior | Updated belief after seeing evidence |

**Deriving it**

It follows directly from the definition of conditional probability:

$$
P(H \\mid E) = \\frac{P(H \\cap E)}{P(E)}, \\quad P(E \\mid H) = \\frac{P(H \\cap E)}{P(H)}
$$

Solving both for $P(H \\cap E)$ and equating gives Bayes' theorem.

The denominator expands via the law of total probability over a partition $\\{H_i\\}$:

$$
P(E) = \\sum_i P(E \\mid H_i)\\, P(H_i)
$$

**MAP estimation**

In ML we often want the most probable hypothesis given data $\\mathcal{D}$:

$$
\\hat{\\theta}_{\\text{MAP}} = \\arg\\max_\\theta P(\\theta \\mid \\mathcal{D}) = \\arg\\max_\\theta \\bigl[\\log P(\\mathcal{D} \\mid \\theta) + \\log P(\\theta)\\bigr]
$$

(The $P(\\mathcal{D})$ term is constant w.r.t. $\\theta$ and drops out.) This is maximum likelihood estimation (MLE) plus a log-prior regularization term. Gaussian prior $P(\\theta) \\propto e^{-\\lambda \\|\\theta\\|^2}$ gives L2 regularization; Laplace prior gives L1.

**Full Bayesian inference**

Rather than a point estimate, we maintain the full posterior $P(\\theta \\mid \\mathcal{D})$ and integrate it out for predictions:

$$
P(y^* \\mid x^*, \\mathcal{D}) = \\int P(y^* \\mid x^*, \\theta)\\, P(\\theta \\mid \\mathcal{D})\\, d\\theta
$$

This integral is usually intractable, leading to approximations:

- **MCMC** (Markov Chain Monte Carlo) — draw samples from the posterior
- **Variational inference** — approximate $P(\\theta \\mid \\mathcal{D})$ with a tractable family $q_\\phi(\\theta)$ by minimizing KL divergence
- **Laplace approximation** — fit a Gaussian to the posterior at the MAP estimate using the Hessian

**The Bayesian perspective on neural networks**

A neural network with weights $\\theta$ defines $P(y \\mid x, \\theta)$. From a Bayesian view, training is posterior inference. The prior $P(\\theta)$ encodes inductive biases; the posterior $P(\\theta \\mid \\mathcal{D})$ represents everything the model has learned. Practical Bayesian deep learning (e.g., MC Dropout, deep ensembles) approximates this posterior to get calibrated uncertainty estimates.`,
		['1.3.1'],
		{ promptTokens: 464, responseTokens: 410 }
	);

	// ── Exchange 1.3.1: KL divergence ─────────────────────────────────────────
	exchanges['1.3.1'] = exchange(
		'1.3.1',
		'1.3',
		'[1.3.1] You mentioned minimizing KL divergence in variational inference. What is KL divergence and why do we minimize it?',
		`KL divergence is a measure of how different two probability distributions are. It's asymmetric and not a true distance, but it has properties that make it the natural choice for variational inference.

**Definition**

For distributions $P$ and $Q$ over the same space:

$$
D_{\\text{KL}}(P \\| Q) = \\sum_x P(x) \\log \\frac{P(x)}{Q(x)}
$$

In the continuous case, replace the sum with an integral. Key properties:

- $D_{\\text{KL}}(P \\| Q) \\geq 0$ always (Gibbs' inequality)
- $D_{\\text{KL}}(P \\| Q) = 0$ iff $P = Q$ almost everywhere
- **Asymmetric**: $D_{\\text{KL}}(P \\| Q) \\neq D_{\\text{KL}}(Q \\| P)$ in general

**Why it's non-negative: Jensen's inequality**

Since $-\\log$ is convex:

$$
D_{\\text{KL}}(P \\| Q) = \\mathbb{E}_P\\!\\left[\\log\\frac{P(x)}{Q(x)}\\right] = -\\mathbb{E}_P\\!\\left[\\log\\frac{Q(x)}{P(x)}\\right] \\geq -\\log\\mathbb{E}_P\\!\\left[\\frac{Q(x)}{P(x)}\\right] = -\\log 1 = 0
$$

**Variational inference setup**

We want to approximate the intractable posterior $P(\\theta \\mid \\mathcal{D})$ with a tractable $q_\\phi(\\theta)$ (e.g., a mean-field Gaussian). We minimize:

$$
D_{\\text{KL}}(q_\\phi(\\theta) \\| P(\\theta \\mid \\mathcal{D}))
$$

Expanding using Bayes:

$$
D_{\\text{KL}}(q_\\phi \\| P(\\theta \\mid \\mathcal{D})) = \\mathbb{E}_{q_\\phi}\\!\\left[\\log q_\\phi(\\theta) - \\log P(\\theta \\mid \\mathcal{D})\\right]
$$

$$
= \\mathbb{E}_{q_\\phi}\\!\\left[\\log q_\\phi(\\theta) - \\log P(\\mathcal{D} \\mid \\theta) - \\log P(\\theta)\\right] + \\log P(\\mathcal{D})
$$

Since $\\log P(\\mathcal{D})$ is constant w.r.t. $\\phi$, minimizing KL is equivalent to maximizing the **ELBO** (Evidence Lower Bound):

$$
\\mathcal{L}(\\phi) = \\mathbb{E}_{q_\\phi}[\\log P(\\mathcal{D} \\mid \\theta)] - D_{\\text{KL}}(q_\\phi(\\theta) \\| P(\\theta))
$$

The ELBO decomposes into a reconstruction term (fit the data) and a regularization term (stay close to the prior).

**Forward vs. reverse KL**

The direction matters:

- **Reverse KL** $D_{\\text{KL}}(q \\| P)$ — zero-forcing: $q$ avoids placing mass where $P$ is small. Tends to produce underestimates of variance (mode-seeking).
- **Forward KL** $D_{\\text{KL}}(P \\| q)$ — zero-avoiding: $q$ must cover all regions where $P$ is nonzero. Tends to overestimate variance (mean-seeking).

Variational inference uses reverse KL because it's tractable (we sample from $q$, which we control). This explains why VI posteriors tend to be overconfident (underestimate uncertainty) compared to exact Bayesian inference.`,
		[],
		{ promptTokens: 916, responseTokens: 388 }
	);

	return { rootId: '1', exchanges };
}
