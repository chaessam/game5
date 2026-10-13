from math import gcd
from itertools import product
def divs(n): return [d for d in range(1,n+1) if n%d==0]
def fam(n):
    f=[]
    if n%2==0: f.append('짝꿍')
    if n%3==0: f.append('세모')
    if n%5==0: f.append('다섯손')
    if len(divs(n))==2: f.append('단단')
    if len(divs(n))>=6: f.append('부자')
    return f
def split(n):
    b=None
    for a in range(2,int(n**.5)+1):
        if n%a==0: b=(a,n//a)
    return b
R=[1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,20,21,24,25,28,30,36]
for F in ['짝꿍','세모','다섯손','단단','부자']:
    print(F,[n for n in R if F in fam(n)])
for n in R: print(n,fam(n),len(divs(n)),divs(n), split(n) if len(divs(n))>=6 else '')
print('outside', {n:fam(n) for n in range(2,41) if n not in R})
print('no family 2..60',[n for n in range(2,61) if not fam(n)])
TIER={'짝꿍':[2,4,6],'세모':[3,5,7],'다섯손':[2,4,6],'단단':[2,4,6],'부자':[3,5,7]}
ROLE={1:'가수',2:'치료사',3:'가수',4:'기사',5:'마법사',6:'치료사',7:'사냥꾼',8:'닌자',9:'마법사',10:'사냥꾼',11:'닌자',12:'기사',13:'치료사',15:'기사',16:'사냥꾼',17:'가수',18:'기사',20:'마법사',21:'닌자',24:'가수',25:'사냥꾼',28:'닌자',30:'치료사',36:'마법사'}
def syn(board):  # board: list of (char, num)
    out={}
    for F,t in TIER.items():
        c=len({num for ch,num in board if F in fam(num)}); tier=sum(c>=x for x in t); out[F]=(c,tier)
    r={}
    for ch,num in board:
        r.setdefault(ROLE[ch],set()).add(ch)
    out['직업']={k:(len(v),sum(len(v)>=x for x in [2,4])) for k,v in r.items()}
    return out
def beat(board,b):
    s=[(ch,num) for ch,num in board if ch!=1 and b%num==0]
    return s
tut={'R1':[(4,4),(2,2),(6,6)],'R2':[(4,4),(2,2),(6,6),(3,3)],'R3a 5 놓기':[(4,4),(2,2),(6,6),(3,3),(5,5)],'R3b 5x2':[(4,4),(2,2),(6,6),(3,3),(5,10)],'R3c 9와3교체':[(4,4),(2,2),(6,6),(9,9),(5,10)],'R4 L6 +7':[(4,4),(2,2),(6,6),(9,9),(5,10),(7,7)],'R5 robot':[(12,12),(18,18),(24,24),(3,3),(4,4)]}
for k,b in tut.items():
    print(k, syn(b))
    for bt in [2,3,4,6,7,9,10,12,14,18,20,21,24,28,30,36]:
        s=beat(b,bt)
        if s: print('   ',bt,[n for _,n in s], 'all단단' if all('단단' in fam(n) for _,n in s) else '')
print('gcd',gcd(4,6),gcd(3,6),gcd(4,7),gcd(9,6),gcd(10,4),gcd(12,18),gcd(12,24),gcd(18,36))
# 7 overlaps within 48
for p in [7,11,13,17]:
    print(p,{b:[n for n in R if b%n==0 and n not in (1,p)] for b in range(2*p,49,p)})
# beats chorus count roster
for b in [12,24,30,36,48]: print(b,[n for n in R if b%n==0])
# skill numbers
def st(x): return [x,2*x,3*x]
print('2',st(2*6),'3',st(3*12),'4',st(4*6),'5',st(5*14),'6',st(6*2),'7',st(7*2),[7*7*2*s for s in (1,2,3)],'8',st(16),[128*s for s in (1,2,3)],'9',st(26),[9*26*s for s in (1,2,3)],'10',st(80),'11',st(110),[220*s for s in (1,2,3)],'12',st(120),'13',st(39),'15',st(75),st(90),'16',[[16*8*s//2**i for i in range(4)] for s in (1,2,3)],'17',st(119),'18',st(90),st(36),'20',st(140),'24',st(96),st(48),'25',st(250),st(125),'30',st(150),st(75),'36',st(216),st(108))
dice=[e*21 for e in [1,2,3,4,5,6,6]]; print('21 dice',dice,sum(dice))
k28=[c*28*3//4 for c in [1,2,4,7,14]]; print('28',k28,sum(k28),[x//2 for x in k28],sum(x//2 for x in k28))
# stones results
def ap(n,s):
    m={'+1':n+1,'-1':n-1,'x2':n*2,'x3':n*3,'/2':n//2 if n%2==0 else None,'/3':n//3 if n%3==0 else None}[s]
    return m if m and 2<=m<=40 else None
print('5x2',ap(5,'x2'),fam(10),'7-1',ap(7,'-1'),fam(6),'11+1',fam(12),'24+1',fam(25),'8x3',fam(24),'16x2',fam(32),len(divs(32)),'21/3',fam(7),'36/2',fam(18),'9x2',fam(18),'25-1',fam(24),'15x2',fam(30))
print('7을 세모로: 7-1=6',fam(6),'7x3=21',fam(21))
# pools
pool={1:[2,3,4,5,6,7],2:[8,9,10,11,15,16],3:[12,13,17,18,21],4:[1,20,24,25,28],5:[30,36]}
cnt={1:18,2:15,3:12,4:10,5:9}
print('pool',sum(len(v)*cnt[c] for c,v in pool.items()), {c:len(v)*cnt[c] for c,v in pool.items()})
odds=[[75,25,0,0,0],[55,35,10,0,0],[40,35,20,5,0],[21,35,28,12,4],[15,25,33,20,7],[10,18,30,28,14]]
print([sum(r) for r in odds])
# 28 split etc
print({n:split(n) for n in [12,18,20,24,28,30,32,36,40]})
print('bag', {n:split(n) for n in [16,9,10,14,22,26,33,34,39,8,4,6,15,21,25,27,35]})
# 30-beat 30 lcm
from math import lcm
print(lcm(2,3,5),lcm(4,6),lcm(2,5),lcm(3,5),lcm(3,7),lcm(7,11),lcm(2,7))
# odd divisor counts
print({n:len(divs(n)) for n in R if len(divs(n))%2})
# interest examples
print(27//10,27%10,19//10,19%10,13//10)
