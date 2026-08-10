---
title: "math"
bio: "xxdy"
avatar: ""
---

### 1   积分入门

​	我们已知对于一个可导函数 $y=f(x)$ ，其导函数  $f'(x)=\lim\limits_{x\rightarrow\infty}\frac{\triangle y}{\triangle x} $ ，其微分 $dy=f'(x)\,\triangle x$

​	由此可以定义积分。积分分为定积分和不定积分。

​	**定积分**为$f(x)$与$x$轴在$[a, b]$上围成的面积。

​	**不定积分**为导数运算的逆运算。若 $F′(x)=f(x)$，则称 $F(x)$ 是 $f(x)$ 的一个原函数。$f(x)$ 的全体原函数称为不定积分。
$$
\begin{align*}
&\int_a^b f(x) \, dx = S = F(b) - F(a) \\
&\int f'(x) \, dx = f(x) + C \qquad (C\in \mathbb{R}\,\text{为积分常数})
\end{align*}
$$
• $∫$ 是拉丁语 $summa$（总和）的拉长，表示“求和”。

• $dx$ 表示“自变量 $x$ 的微分”（一个无穷小的增量）。

​	合起来 $∫f(x) dx$ 的意思是：把函数值 $f(x)$ 乘上无穷小的区间长度 $dx$，然后对这些无穷小的乘积求和。这是一种对“连续量”的求和操作。

##### 常用积分

$$
\begin{align*}
&\int x^n \, dx = \frac{x^{n+1}}{n+1} + C \quad (n \neq -1) \\
&\int \frac{1}{x} \, dx = ln \, |x| +C \\
&\int a^x \, dx = \frac{a^x}{ln \, a} \\
&\int u \, dv = uv - \int v \, du
\end{align*}
$$

---

### 2. 无穷级数

​	给定一个数列$\{a_n\}$，以下形式表达式称为无穷级数。
$$
\sum_{n=1}^\infty a_n = a_1+a_2+a_3+\cdots
$$
​	若$\lim_{n\rightarrow\infty} S_n$存在有限，则级数收敛，否则发散。

​	常见的收敛级数有
$$
\sum_{n=0}^\infty x^n = \frac{1}{1-x}\qquad\bold{几何级数}\\
\sum_{n=0}^\infty \frac{1}{x^k} \qquad\bold{调和级数，}k>1\\
\sum_{n=0}^\infty (-1)^{n-1}a_n \qquad\bold{交错级数，}a_n单调递减趋于0
$$


#### 2.1 泰勒展开

​	对于在 $x = a$ 处具有任意阶导数的函数 $f(x)$，其泰勒展开为：

$$
f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!} (x-a)^n
$$
​	特别地，当 $a = 0$ 时称为**麦克劳林级数**。

​	推导如下：

​	$令\,f(x) = a_0x^0+a_1x^1+a_2x^2+\cdots\quad在x=0处具有任意阶导数$
$$
\begin{align*}
f'(x) &= a_1+2a_2x^1+3a_3x^2+\cdots \qquad &（两边同时求导）\cdots\cdots\cdots\cdots①&\\
&f^{(1)}(0) = a_1 &（令\,x=0）\quad\cdots\cdots\cdots\cdots②&\\
\end{align*}
$$
​	重复①②过程可得
$$
a_n = f^{(n)}(0)\\
f(x)=f^{(1)}(0)+f^{(1)}(0)x^1+f^{(3)}(0)x^2+\cdots\\
$$

##### 常见函数的泰勒展开

$$
e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!}, \quad x \in \mathbb{R}\\
\sin x = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n+1}}{(2n+1)!}, \quad x \in \mathbb{R}\\
\cos x = \sum_{n=0}^{\infty} \frac{(-1)^n x^{2n}}{(2n)!}, \quad x \in \mathbb{R}
$$

#### 2.2 傅里叶展开

​	泰勒展开式是将 $f(x)$ 表示成 $x$ 的幂级数。与此相对，傅里叶展开式则是将 $f(x)$ 表示成三角函数的级数。

**f(x)的傅里叶展开式**
$$
\begin{align*}
f(x)=(a_0\,cos\,0x+b_0\,sin\,0x)&\\
+(a_1\,cos\,1x+b_1&\,sin\,1x)\\
+(a_2\,cos\,2x&+b_2\,sin\,2x)\\
+\cdots+&(a_k\,cos\,kx+b_k\,sin\,kx)+\cdots\\
=\sum_{k=0}^\infty\, (a_k\,cos\,kx+b_k\,sin\,&kx)
\end{align*}
$$
可自行求得数列 $\{a_n\}$ 和 $\{b_n\}$，只需用 $f(x)$ 乘上 $cos\,nx$ 和 $sin\,nx$，再从 $-\pi$ 积分到 $\pi$。

------

### 3 生成函数

​	接着再讨论一下生成函数。

​	首先，将刚才讨论的幂级数想象成关于 $x$ 的函数。
$$
\underline1x^0+\underline1x^1+\underline1x^2+\underline1x^3+\cdots
$$
​	各系数形成了 $\{1\,,1\,,1\,,1\,,\cdots\}$ 的无穷数列。于是我们可以想到一下的对应情况。
$$
\begin{align*}
数列 \quad &\leftrightarrow \quad 函数\\
\{1\,,1\,,1\,,1\,,\cdots\} \quad &\leftrightarrow \quad 1+x+x^2+x^3+\cdots=\frac{1}{1-x}
\end{align*}
$$
​	像这样与数列相对应的函数叫做**生成函数**。

​	可以将求数列的通项公式转为生成函数的运算。
$$
\boxed{
数列 \longrightarrow 生成函数 \longrightarrow 生成函数的有限项代数式 \longrightarrow 数列的通项
}
$$
​	例如，以斐波那契数列为例。
$$
F(n)=
\left\{
\begin{align*}
&0 &(n=0)\\
&1 &(n=1)\\
&F_{n-2}+F_{n-1} &(n\geq2)
\end{align*}
\right.
$$

$$
\begin{align*}
数列 \quad &\leftrightarrow \quad 生成函数\\
\{F_0\,,F_1\,,F_2\,,F_3\,,\cdots\} \quad &\leftrightarrow \quad F(x)
\end{align*}
$$

​	由于斐波那契数列有 $F_n=F_{n-2}+F_{n-1}$，可以考虑这三项。
$$
F(x)=\cdots+\underline{F_{n-2}x^{n-2}}+\underline{F_{n-1}x^{n-1}}+\underline{F_nx^n}+\cdots
$$
​	为了统一 $x$ 的次数，可以将 $F(x)$ 分别和 $x$ , $x^2$ , $x^3$ 相乘。
$$
\begin{align*}
&A:  F(x)\cdot x^2 = \qquad\qquad\qquad\;\;\; F_0x^2+F_1x^3+F_2x^4+\cdots \\
&B:  F(x)\cdot x^1 = \qquad\quad\,\ F_0x^1+F_1x^2+F_2x^3+F_3x^4+\cdots \\
&C:  F(x)\cdot x^0 = F_0x^0+F_1x^1+F_2x^2+F_3x^3+F_4x^4+\cdots \\
\end{align*}
$$
​	$A+B-C$ 得
$$
F(x)\cdot (x^2+x^1-x^0) = -x\\
\boxed{F(x) = \frac{x}{1-x^2}}
$$
​	接下来将 $F(x)$ 用 $x$ 的无穷级数表示。若直接做泰勒展开，会有 $a_n=\frac{1}{n!}\frac{dn}{dx^n}\frac{x}{1-x-x^2}\Big|_{x=0}$ ，找闭式公式非常困难，所以考虑转化成常见的级数。
$$
设\frac{x}{1 - x - x^2} = \frac{A}{1 - \phi x} + \frac{B}{1 - \psi x}，其中\phi,\psi=\frac{1\pm\sqrt5}{2} \\
解得A=-B=\frac{1}{\phi-\psi} \\
所以F(x)=\frac{1}{\phi-\psi}\left(\frac{1}{1 - \phi x} + \frac{1}{1 - \psi x}\right) \\
由\frac{1}{1-ax}=\sum_{n=0}^\infty r^nx^n \quad\Rightarrow\quad F(x)=\frac{1}{\phi-\psi}\sum_{n=1}^{\infty} (\phi^n-\psi^n)x^n
$$
​	代入 $\phi$ 和 $\psi$ 就能得出斐波那契数列的通项公式了。
$$
\boxed{F_n = \frac{1}{\sqrt{5}} \left( \left( \frac{1+\sqrt{5}}{2} \right)^n - \left( \frac{1-\sqrt{5}}{2} \right)^n \right)}
$$


**挑战** 
$$
0+1=(0+1)
$$
​	如果有 1 个加号的话，只有 1 种加法组合	$(C_1=1)$
$$
\begin{align*}
0+1+2&=(0+(1+2))\\
&=((0+1)+2)
\end{align*}
$$
​	如果有 2 个加号的话，有 2 种加法组合	$(C_2=2)$
$$
\begin{align*}
0+1+2+3&=(0+(1+(2+3)))\\
&=(0+((1+2)+3))\\
&=((0+1)+(2+3))\\
&=((0+(1+2))+3)\\
&=(((0+1)+2)+3)
\end{align*}
$$
​	那么如果有 $n$ 个加号的话，有几种加法组合呢？	$(C_n=n)$

​	要求加括号后仅有一种运算顺序。$C_4=14$

​	提示：
​	常规做法是先求递推，再用生成函数求通项。但若注意到即使将数字与右括号全部去掉，也能恢复原貌，则可以立即使用排列组合做出。