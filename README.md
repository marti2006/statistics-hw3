# Penetration process: Law of Large Numbers, variance and Central Limit Theorem

Simulation of **n systems** and **m attackers**. The penetration process is modelled as a random walk with i.i.d. increments $X_1, X_2, \dots$. We study the total score $S_n$, the average score $S_n/n$ and the normalized total score $S_n/\sqrt n$ under the **Bernoulli** and **Rademacher** models.

The web application (HTML + CSS + JavaScript, no external libraries) runs every simulation in the browser and draws the charts on `<canvas>`.

## How to run

Open `index.html` in a browser (double-click it, or use GitHub Pages). The simulations start on page load and take a few seconds; sections fill in as they complete. The bar at the top lets you change $p$, the number of attackers $m$ and the seed; then press **Rigenera** (regenerate).

With the default parameters (seed 2026, $p = 0.3$, $m = 5000$) the page produces **exactly** the numbers reported here: the random number generator is deterministic and the experiments always run in the same order.

## Repository structure

| File | Contents |
|---|---|
| `index.html` | page with the homework sections, charts and tables |
| `style.css` | styling (colors, layout of charts and tables) |
| `js/sim.js` | simulation core: random generator, models, statistics, experiments (no DOM) |
| `js/plot.js` | small canvas charting library (lines, points, bars, linear and log axes) |
| `js/main.js` | runs the experiments and renders charts and tables |
| `README.md` | this report |

---

## 1. The model

Each attacker $j = 1, \dots, m$ attacks systems $1, \dots, n$ in sequence. The increment $X_i^{(j)}$ is the score obtained on system $i$, and the attacker's trajectory is

$$S_k^{(j)} = \sum_{i=1}^{k} X_i^{(j)}, \qquad k = 1, \dots, n.$$

The $m$ attackers are $m$ independent trajectories: they form the **Monte Carlo sample** used to estimate the distributions of $S_n$, $S_n/n$ and $S_n/\sqrt n$.

| Model | Values | $\mu = E[X]$ | $\sigma^2 = \mathrm{Var}(X)$ | Meaning |
|---|---|---|---|---|
| Bernoulli($p$) | $\{0, 1\}$ | $p$ | $p(1-p)$ | 1 = system breached, 0 = attack failed |
| Rademacher | $\{-1, +1\}$ | $0$ | $1$ | +1 progress, −1 attack repelled (symmetric case) |

### Theoretical results

By linearity and independence, $E[S_n] = n\mu$ and $\mathrm{Var}(S_n) = \sum_i \mathrm{Var}(X_i) = n\sigma^2$. Hence:

| Quantity | Mean | Variance | Behaviour as $n \to \infty$ |
|---|---|---|---|
| $S_n$ | $n\mu$ | $n\sigma^2$ | the variance diverges |
| $S_n/n$ | $\mu$ | $\sigma^2/n$ | $\to \mu$ in probability (**LLN**) |
| $S_n/\sqrt n$ | $\sqrt n\,\mu$ | $\sigma^2$ | if $\mu = 0$: $\to N(0, \sigma^2)$ in distribution (**CLT**) |

- **Weak Law of Large Numbers.** For every $\varepsilon > 0$, $P(|S_n/n - \mu| > \varepsilon) \to 0$. Chebyshev's inequality gives it directly: $P(|S_n/n - \mu| > \varepsilon) \le \sigma^2/(n\varepsilon^2)$.
- **Central Limit Theorem.** $(S_n - n\mu)/(\sigma\sqrt n) \xrightarrow{d} N(0,1)$. In the Rademacher model ($\mu = 0$, $\sigma = 1$) this quantity is exactly $S_n/\sqrt n$.
- **Berry–Esseen.** $\sup_x |F_n(x) - \Phi(x)| \le C\,E|X - \mu|^3 / (\sigma^3 \sqrt n)$ with $C \le 0.4748$. For Rademacher $E|X|^3 = 1$, so the bound is $0.4748/\sqrt n$.

In the Bernoulli model $S_n/\sqrt n$ has mean $\sqrt n\,p \to \infty$, so it does not converge: it must first be centred. This is why the assignment introduces the Rademacher model, symmetric and zero-mean, in which $S_n/\sqrt n$ converges directly to the standard normal.

---

## 2. Method

- **Random generator.** `mulberry32` with a fixed seed, so that results are reproducible.
- **Bernoulli.** $X_i = 1$ if $U_i < p$, with $U_i$ uniform on $[0,1)$.
- **Rademacher.** Each bit of a random 32-bit word is a fair coin. One word gives 32 increments, and $S_n = 2 \cdot (\text{number of 1-bits}) - n$. This is equivalent to tossing $n$ coins, but about 30 times faster. I checked the generator over 200 seeds: the mean variance of $S_n/\sqrt n$ is $0.999$, and its spread ($0.020$) matches the theoretical value $\sqrt{2/m}$.
- **Values of $n$.** $n \in \{10, 100, 1\,000, 10\,000\}$ for the distributions; 10–13 log-spaced values between 10 and 10 000 for the convergence studies.
- **Choice of $m$.** The limit theorems are about $n$; $m$ sets the precision with which we observe them, because the Monte Carlo error scales as $1/\sqrt m$. I used:
  - $m = 30$ for the trajectory plots, where a few readable curves are enough;
  - $m = 5\,000$ for the distributions and the LLN: the standard error of a frequency is at most $0.5/\sqrt{5000} \approx 0.007$;
  - $m = 2\,000$ for the variance study;
  - $m = 10\,000$ for the Kolmogorov distance, whose noise floor is $1.36/\sqrt m \approx 0.014$.
- **Histograms.** $S_n$ is an integer, and in the Rademacher model it has the same parity as $n$. Bins are therefore multiples of the lattice step (1 or 2), centred on the attainable values, to avoid binning artefacts.
- **Exact distance from the normal.** In the Rademacher model $(S_n + n)/2 \sim \mathrm{Bin}(n, 1/2)$, so $\sup_x |F_n(x) - \Phi(x)|$ can be computed exactly and compared with the simulated estimate.

---

## 3. Results

### 3.1 Sample trajectories

I simulated 30 attackers on $n = 10\,000$ systems and plotted $S_k$, $S_k/k$ and $S_k/\sqrt k$ against $k$, together with the theoretical mean and a band of ±2 standard deviations.

- **$S_k$.** In the Bernoulli model it grows linearly with slope $p = 0.3$: on average an attacker breaches 30% of the systems. In the Rademacher model it oscillates around 0. In both cases the bundle of trajectories **widens** like $\sqrt k$.
- **$S_k/k$.** All trajectories **narrow** towards $\mu$, with a width that shrinks like $1/\sqrt k$. This is the LLN seen on individual trajectories; the strong law, i.e. almost-sure convergence, also holds.
- **$S_k/\sqrt k$.** In the Rademacher model the bundle has **constant** width, inside the $\pm 2$ band. In the Bernoulli model the drift $\sqrt k\,p$ makes the trajectories diverge.

### 3.2 Distributions as $n$ grows

- **$S_n$** shifts (mean $np$) and spreads out (standard deviation $\sigma\sqrt n$): there is no limiting distribution.
- **$S_n/n$** concentrates more and more on $\mu$, until it becomes a spike.
- **$S_n/\sqrt n$** in the Rademacher model takes a Gaussian shape from about $n = 100$. At $n = 10$ it takes only 11 values, but the profile is already bell-shaped. In the Bernoulli model the width stays constant ($\sigma = \sqrt{0.21} \approx 0.46$) while the distribution drifts to the right like $\sqrt n\,p$.

### 3.3 Variance under the different normalizations

Values with $m = 5\,000$ attackers:

| model | $n$ | mean $S_n/n$ | $\mu$ | Var $S_n$ | $n\sigma^2$ | Var $S_n/n$ | $\sigma^2/n$ | Var $S_n/\sqrt n$ | $\sigma^2$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bernoulli | 10 | 0.3022 | 0.300 | 2.1 | 2.1 | 2.05e-2 | 2.10e-2 | 0.2055 | 0.210 |
| Bernoulli | 100 | 0.2996 | 0.300 | 20.3 | 21.0 | 2.03e-3 | 2.10e-3 | 0.2030 | 0.210 |
| Bernoulli | 1000 | 0.3002 | 0.300 | 206.9 | 210.0 | 2.07e-4 | 2.10e-4 | 0.2069 | 0.210 |
| Bernoulli | 10000 | 0.3000 | 0.300 | 2073.5 | 2100.0 | 2.07e-5 | 2.10e-5 | 0.2074 | 0.210 |
| Rademacher | 10 | 0.0016 | 0.000 | 10.2 | 10.0 | 1.02e-1 | 1.00e-1 | 1.0247 | 1.000 |
| Rademacher | 100 | −0.0019 | 0.000 | 95.7 | 100.0 | 9.57e-3 | 1.00e-2 | 0.9570 | 1.000 |
| Rademacher | 1000 | −0.0004 | 0.000 | 1004.9 | 1000.0 | 1.00e-3 | 1.00e-3 | 1.0049 | 1.000 |
| Rademacher | 10000 | −0.0001 | 0.000 | 9981.3 | 10000.0 | 9.98e-5 | 1.00e-4 | 0.9981 | 1.000 |

The deviations from theory are consistent with sampling error. The relative error of a variance estimated from $m$ samples is about $\sqrt{2/m} = 2\%$, and only the Rademacher case with $n = 100$ reaches about 2 standard deviations, which is expected across 8 comparisons.

Over 13 values of $n$ between 10 and 10 000 ($m = 2\,000$), the estimated log-log slopes are:

| model | Var $S_n$ (theory +1) | Var $S_n/n$ (theory −1) | Var $S_n/\sqrt n$ (theory 0) |
|---|---:|---:|---:|
| Bernoulli | +1.002 | −0.998 | +0.002 |
| Rademacher | +0.999 | −1.001 | −0.001 |

**Interpretation.**
- Dividing by 1 is **too little**: the variance grows without bound.
- Dividing by $n$ is **too much**: the variance goes to 0 and only the constant $\mu$ survives. This is the LLN scale.
- Dividing by $\sqrt n$ is the **critical** scale: the only one that keeps the variance finite and non-zero. Only at this scale can a non-degenerate limit in distribution exist, and it is the CLT scale.

### 3.4 Law of Large Numbers

I estimated $P(|S_n/n - \mu| > \varepsilon)$ as the fraction of attackers (out of $m = 5\,000$) whose average score differs from $\mu$ by more than $\varepsilon$. The result for $\varepsilon = 0.05$:

| model | $n = 10$ | $n = 100$ | $n = 1\,000$ | $n = 10\,000$ |
|---|---:|---:|---:|---:|
| Bernoulli | 0.7332 | 0.2276 | 0.0004 | 0.0000 |
| Rademacher | 0.7612 | 0.6020 | 0.1068 | 0.0000 |

The probability goes to 0: this is the **convergence in probability** of $S_n/n$ to $\mu$. The chart for $\varepsilon \in \{0.1, 0.05, 0.02\}$ shows three things.

- **The smaller $\varepsilon$, the more systems are needed.** The probability becomes negligible only when $n \gg \sigma^2/\varepsilon^2$. In the Rademacher model with $\varepsilon = 0.02$ it is still 0.045 at $n = 10\,000$.
- **Chebyshev's bound is pessimistic.** It always holds but decreases only like $1/n$, whereas the true probability decreases **exponentially** in $n$. Hoeffding gives $P \le 2e^{-2n\varepsilon^2/(b-a)^2}$, and the normal approximation $2(1 - \Phi(\varepsilon\sqrt n/\sigma))$ follows the simulated points very closely.
- **The Rademacher model converges more slowly.** Its variance is 1 against 0.21 for Bernoulli: for the same $\varepsilon$, a noisier process needs about $1/0.21 \approx 5$ times more systems.

### 3.5 Central Limit Theorem (Rademacher)

The histograms of $S_n/\sqrt n$ overlap the $N(0,1)$ density better and better, and the QQ-plots line up with the diagonal. At $n = 10$ the QQ-plot is a staircase because the variable is discrete; from $n = 1\,000$ it is practically a straight line.

| $n$ | mean | variance | skewness | excess kurtosis | exact $-2/n$ | $P(\lvert Z\rvert>1.96)$ | KS dist. (sim.) | KS dist. (exact) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 0.0051 | 1.0247 | −0.0169 | −0.2812 | −0.2000 | 0.0226 | 0.1218 | 0.1230 |
| 100 | −0.0191 | 0.9570 | −0.0048 | 0.1284 | −0.0200 | 0.0508 | 0.0524 | 0.0398 |
| 1000 | −0.0121 | 1.0049 | 0.0272 | −0.0307 | −0.0020 | 0.0534 | 0.0273 | 0.0126 |
| 10000 | −0.0125 | 0.9981 | 0.0070 | −0.1705 | −0.0002 | 0.0462 | 0.0168 | 0.0040 |

- **Mean and variance** are $0$ and $1$ for every $n$, because the normalization guarantees it. What converges is the **shape**. Skewness is zero by symmetry, and the excess kurtosis is exactly $-2/n \to 0$. With $m = 5\,000$ the estimated kurtosis has a standard error of about $\sqrt{24/m} \approx 0.07$, which explains the observed deviations.
- **$P(|Z| > 1.96)$** tends to the Gaussian 5%. At $n = 10$ it is about 2% because of a lattice effect: $|S_{10}| > 6.2$ is equivalent to $|S_{10}| \ge 8$, whose exact probability is $22/1024 \approx 0.021$.
- **The simulated distance** cannot fall below the Monte Carlo noise ($\approx 1.36/\sqrt m$), so for large $n$ it is dominated by noise. This is why the exact distance is also computed.

**Rate of convergence.** Kolmogorov distance $\sup_x |F_n(x) - \Phi(x)|$ with $m = 10\,000$:

| $n$ | 10 | 22 | 46 | 100 | 215 | 464 | 1000 | 2154 | 4642 | 10000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rademacher, simulated | 0.130 | 0.088 | 0.067 | 0.047 | 0.031 | 0.030 | 0.018 | 0.013 | 0.013 | 0.013 |
| Rademacher, exact | 0.123 | 0.084 | 0.059 | 0.040 | 0.027 | 0.019 | 0.013 | 0.009 | 0.006 | 0.004 |
| Berry–Esseen $0.4748/\sqrt n$ | 0.150 | 0.101 | 0.070 | 0.047 | 0.032 | 0.022 | 0.015 | 0.010 | 0.007 | 0.005 |
| Standardized Bernoulli, simulated | 0.143 | 0.102 | 0.068 | 0.053 | 0.037 | 0.028 | 0.019 | 0.019 | 0.010 | 0.018 |

- **The exact distance decreases like $1/\sqrt n$.** The log-log slope is $-0.497$, against the theoretical $-0.5$, and the curve always stays below the Berry–Esseen bound. The dominant term is precisely the lattice effect: the jump of the distribution function at 0 is about $\sqrt{2/(\pi n)}$.
- **The simulated distance flattens out.** From $n \approx 2\,000$ it stays at about $0.013$, i.e. the Monte Carlo noise $1.36/\sqrt{10\,000} \approx 0.014$. With finite $m$ smaller distances cannot be "seen".
- **The Bernoulli model also converges.** Standardized, $(S_n - np)/\sqrt{np(1-p)}$ also tends to the normal, because the CLT holds for any finite variance. It converges a little more slowly, however, because for $p \ne 1/2$ the distribution is skewed, with skewness $(1-2p)/\sqrt{np(1-p)}$. Its Berry–Esseen constant is also larger: $0.4748\,E|X-p|^3/\sigma^3 \approx 0.60$.

### 3.6 The role of the number of attackers $m$

**$m$ as statistical precision** (Rademacher, $n = 1\,000$; standard deviation over 100 repetitions):

| $m$ | 10 | 30 | 100 | 300 | 1000 | 3000 |
|---|---:|---:|---:|---:|---:|---:|
| std. dev. of the estimate of $E[S_n/n]$ | 1.07e-2 | 5.98e-3 | 3.03e-3 | 1.71e-3 | 8.51e-4 | 5.20e-4 |
| theory $\sigma/\sqrt{nm}$ | 1.00e-2 | 5.77e-3 | 3.16e-3 | 1.83e-3 | 1.00e-3 | 5.77e-4 |
| mean KS distance from $N(0,1)$ | 0.277 | 0.158 | 0.098 | 0.060 | 0.036 | 0.025 |

The error decreases like $1/\sqrt m$. The KS distance, however, cannot fall below the true distance at $n = 1\,000$ ($\approx 0.0126$, due to the lattice). Beyond that point increasing $m$ no longer helps: $n$ has to increase.

**$m$ as the size of the threat: the best attacker.** For large $n$ the values $S_n^{(j)}/\sqrt n$ are approximately $m$ independent Gaussians, and the maximum of $m$ Gaussians grows like $\sqrt{2\ln m}$. The table reports the median over 40 repetitions, with $n = 1\,000$:

| $m$ | 3 | 7 | 15 | 31 | 67 | 143 | 305 | 654 | 1401 | 3000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| median of $\max_j S_n^{(j)}/\sqrt n$ | 0.60 | 1.36 | 1.68 | 2.06 | 2.28 | 2.72 | 2.72 | 3.10 | 3.38 | 3.54 |
| median of the max of $m$ $N(0,1)$: $\Phi^{-1}(2^{-1/m})$ | 0.82 | 1.31 | 1.69 | 2.01 | 2.32 | 2.59 | 2.84 | 3.07 | 3.29 | 3.50 |
| asymptotic $\sqrt{2\ln m}$ | 1.48 | 1.97 | 2.33 | 2.62 | 2.90 | 3.15 | 3.38 | 3.60 | 3.81 | 4.00 |

**$m$ and the aggregate score.** The score of all attackers together is $T = \sum_j S_n^{(j)}$, with $E[T] = mnp$ and $\mathrm{sd}(T) = \sqrt{mnp(1-p)}$. Values in the Bernoulli model, over 100 replications:

| $n$ | $m$ | $E[T]$ sim. | $mnp$ | sd $T$ sim. | $\sqrt{mnp(1-p)}$ | $T/(mn)$ |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 10 | 302.1 | 300.0 | 13.6 | 14.5 | 0.3021 |
| 100 | 1000 | 30029.6 | 30000.0 | 153.9 | 144.9 | 0.3003 |
| 1000 | 1000 | 299971.1 | 300000.0 | 418.2 | 458.3 | 0.3000 |

$T$ is a sum of $mn$ i.i.d. increments, so the LLN and the CLT apply with respect to the product $mn$. With 100 replications, the estimated standard deviation has a relative error of about 7%, consistent with the deviations in the table.

---

## 4. Interpretation: $n$ systems and $m$ attackers

### System size $n$

- **$S_n$ is the absolute damage.** It grows linearly in $n$: in the Bernoulli model an attacker breaches $pn$ systems on average. Its uncertainty grows like $\sqrt n$, so a larger infrastructure is exposed to more compromises and to a wider spread between attackers. The **relative** uncertainty $\sigma/(\mu\sqrt n)$, on the other hand, decreases: on large systems the overall outcome of an attack becomes predictable.
- **$S_n/n$ is the compromise rate.** It is the fraction of breached systems (Bernoulli) or the net balance per system (Rademacher). By the LLN, on a large fleet of systems it almost surely matches the intrinsic parameter $\mu$, i.e. the effectiveness of the attack or the weakness of the defence. About $n \gtrsim \sigma^2/\varepsilon^2$ systems are enough to measure it with precision $\varepsilon$: observing many systems removes the luck of the single attack.
- **$S_n/\sqrt n$ is the scale of the fluctuations.** In the symmetric (Rademacher) case attack and defence are balanced and there is no drift. An attacker's net score is of order $\pm\sqrt n$, and for large $n$ its distribution is Gaussian, regardless of the details of a single step. This makes it possible to set **alert thresholds**: without a systematic advantage, $|S_n| > 1.96\sqrt n$ happens only 5% of the time. A very high value of $S_n/\sqrt n$ is therefore evidence that the attacker has $\mu > 0$, which is the principle behind a statistical test.

### Number of attackers $m$

- **As statistical replication**, $m$ does not change the limit theorems: it only sets the precision with which we observe them, with an error proportional to $1/\sqrt m$. Verifying the CLT to precision $\delta$ requires $m \gg 1/\delta^2$ attackers.
- **As a threat**, $m$ matters a lot.
  - The aggregate score grows like $mn\mu$, with fluctuations $\sqrt{mn}\,\sigma$: the effective "attack surface" is the product $mn$.
  - Even in the zero-mean case, the **best attacker** reaches a score of order $\sqrt{2\ln m}\cdot\sqrt n$. With 3 000 attackers the luckiest one typically reaches $3.5\sqrt n$, a value a single attacker would reach with probability of about $2 \cdot 10^{-4}$. In a "balanced" system, many attackers still produce, purely by chance, a few striking successes.
  - This growth is slow, however: only logarithmic in $m$, whereas growth in $n$ is $\sqrt n$.

## 5. Conclusions

The three normalizations describe three levels of reading the same process.

| Quantity | Meaning | Behaviour as $n \to \infty$ |
|---|---|---|
| $S_n$ | absolute damage | grows and becomes increasingly uncertain: variance $n\sigma^2$ |
| $S_n/n$ | compromise rate | settles on $\mu$ (LLN): variance $\sigma^2/n \to 0$ |
| $S_n/\sqrt n$ | scale of the fluctuations | constant variance $\sigma^2$; in the Rademacher case converges to $N(0,1)$ (CLT) at rate $1/\sqrt n$ |

The simulations confirm all the theoretical predictions quantitatively:
- the variance slopes are $+1$, $-1$, $0$;
- the deviation probability goes to 0 for every $\varepsilon$, faster than Chebyshev guarantees;
- the distance from the normal decreases like $1/\sqrt n$, below the Berry–Esseen bound.

The number of attackers $m$ controls the precision of the estimates. From a security standpoint, instead, it determines the aggregate damage and the extreme score of the best attacker.