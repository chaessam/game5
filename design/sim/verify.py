from math import gcd
from itertools import product
def lcm(a,b): return a*b//gcd(a,b)
def divs(n): return [d for d in range(1,n+1) if n%d==0]
def fams(n):
    f=[]
    if n%2==0: f.append('짝꿍')
    if n%3==0: f.append('세모')
    if n%5==0: f.append('별빛')
    if len(divs(n))==2: f.append('단단')
    if len(divs(n))>=6: f.append('부자')
    return f
roster=[1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,20,21,24,25,28,30,36]
print("roster size",len(roster))
designFam={'짝꿍':[2,4,6,8,10,12,16,18,20,24,28,30,36],'세모':[3,6,9,12,15,18,21,24,30,36],
 '별빛':[5,10,15,20,25,30],'단단':[2,3,5,7,11,13,17],'부자':[12,18,20,24,28,30,36]}
for k,v in designFam.items():
    true=[n for n in roster if k in fams(n)]
    print(k,"OK" if true==v else f"MISMATCH true={true}", len(v))
unitFam={1:[],2:['짝꿍','단단'],3:['세모','단단'],4:['짝꿍'],5:['별빛','단단'],6:['짝꿍','세모'],7:['단단'],8:['짝꿍'],
 9:['세모'],10:['짝꿍','별빛'],11:['단단'],12:['짝꿍','세모','부자'],13:['단단'],15:['세모','별빛'],16:['짝꿍'],17:['단단'],
 18:['짝꿍','세모','부자'],20:['짝꿍','별빛','부자'],21:['세모'],24:['짝꿍','세모','부자'],25:['별빛'],28:['짝꿍','부자'],
 30:['짝꿍','세모','별빛','부자'],36:['짝꿍','세모','부자']}
bad=[(n,unitFam[n],fams(n)) for n in roster if sorted(unitFam[n])!=sorted(fams(n))]
print("unit.families mismatches:",bad)
unitRole={1:'가수',2:'치유사',3:'가수',4:'기사',5:'마법사',6:'치유사',7:'사냥꾼',8:'닌자',9:'마법사',10:'사냥꾼',11:'닌자',12:'기사',13:'치유사',15:'기사',16:'사냥꾼',17:'가수',18:'기사',20:'마법사',21:'닌자',24:'가수',25:'사냥꾼',28:'닌자',30:'치유사',36:'마법사'}
roles={'기사':[4,12,15,18],'닌자':[8,11,21,28],'사냥꾼':[7,10,16,25],'마법사':[5,9,20,36],'가수':[1,3,17,24],'치유사':[2,6,13,30]}
for r,v in roles.items():
    t=sorted(n for n in roster if unitRole[n]==r); print("role",r,"OK" if t==v else ("MISMATCH",t))
print("\n# divisor counts 1..40")
dc={n:len(divs(n)) for n in range(1,41)}
print({n:dc[n] for n in roster})
print("max:",max(dc.values()),[n for n in dc if dc[n]==9],"8개:",[n for n in dc if dc[n]==8])
print("odd divisor count in roster:",[n for n in roster if dc[n]%2])
print("부자 in 2..40:",[n for n in range(2,41) if dc[n]>=6])
def split(n):
    ps=[(a,n//a) for a in range(2,int(n**0.5)+1) if n%a==0]
    return min(ps,key=lambda p:p[1]-p[0]) if ps else None
print("splits:",{n:split(n) for n in range(2,41) if dc[n]>=6})
print("분신주머니:",{n:split(n) for n in [4,6,8,9,10,14,16,22,26,27,33,34,35,38,39]})
print("\n# family-less 2..60:",[n for n in range(2,61) if not fams(n)])
off=[n for n in range(2,41) if n not in roster]
print("off-roster:",off)
print({n:fams(n) for n in off})
print("\n# chorus: roster numbers (and 1..40) dividing each beat")
for t in range(1,49):
    r=[d for d in roster if t%d==0]; a=[d for d in range(1,41) if t%d==0]
    if len(r)>=7 or t in (12,24,30,36,48,7,11,13,17,14,21,22,26,28,33,34,35,39,42,44): print(t,len(r),r,"| any 1..40:",len(a))
print("\n# stone table")
stones={'+1':lambda n:n+1,'-1':lambda n:n-1,'x2':lambda n:n*2,'/2':lambda n:n//2 if n%2==0 else None,'x3':lambda n:n*3,'/3':lambda n:n//3 if n%3==0 else None}
def apply(n,s):
    r=stones[s](n)
    if r is None: return None,'not divisible'
    if r<2: return None,'<2'
    if r>40: return None,'>40'
    return r,''
reach=set()
for n in roster:
    row=[]
    for s in stones:
        r,why=apply(n,s)
        if r: reach.add(r)
        row.append(f"{s}:{r if r else 'X('+why+')'}{'' if not r else ('' if r in roster else '*')}{'' if not r else '['+','.join(fams(r))+']'}")
    print(n,' | '.join(row))
print("single-stone off-roster reachable:",sorted(x for x in reach if x not in roster))
reach2=set()
for n in roster:
    for s1,s2 in product(stones,stones):
        r,_=apply(n,s1)
        if r:
            r2,_=apply(r,s2)
            if r2: reach2.add(r2)
print("two-stone reachable off-roster:",sorted(x for x in reach2 if x not in roster), "unreachable 2..40:",[x for x in range(2,41) if x not in reach2|reach|set(roster)])
print("stone result 1 possible?",any(apply(n,s)[0]==1 for n in roster for s in stones))
print("\n# GCD/LCM examples")
for a,b in [(12,18),(4,6),(3,6),(4,13),(12,24),(18,36)]: print('gcd',a,b,gcd(a,b))
for a,b in [(4,6),(2,3),(3,5),(3,7),(2,5),(7,11),(2,4)]: print('lcm',a,b,lcm(a,b))
print('lcm 2,3,4',lcm(lcm(2,3),4),'lcm 2,3,5',lcm(lcm(2,3),5),'lcm 2,4,8',lcm(lcm(2,4),8))
print("\n# skills")
print("2:",[2*7*s for s in (1,2,3)],"3:",[3*14*s for s in (1,2,3)],"4:",[4*6*s for s in (1,2,3)],"5:",[60*s for s in (1,2,3)],5//5,10*12,10//5)
print("6:",[12*s for s in (1,2,3)],"7:",[14*s for s in (1,2,3)],[98*s for s in (1,2,3)],"8:",[16*s for s in (1,2,3)],[128*s for s in (1,2,3)],8//4)
print("9:",[9*16*s for s in (1,2,3)],"10:",[80*s for s in (1,2,3)],"11:",[88*s for s in (1,2,3)],"12:",12//6,6//6,4//6,[120*s for s in (1,2,3)])
print("13:",[26*s for s in (1,2,3)],divmod(13,8),"15:",[75*s for s in (1,2,3)],[90*s for s in(1,2,3)])
print("16:",[[16*c*s for c in (8,4,2,1)] for s in (1,2,3)],"17:",[102*s for s in (1,2,3)],17//6)
print("18:",[90*s for s in (1,2,3)],[54*s for s in (1,2,3)],"20:",[140*s for s in(1,2,3)],20//10)
d=[e*21 for e in range(1,7)];print("21:",d,sum(d),sum(range(1,7)),"÷3→7:",[e*7 for e in range(1,7)])
print("24:",[96*s for s in (1,2,3)],"rehearsal",[48*s for s in (1,2,3)])
print("25:",[250*s for s in(1,2,3)],[125*s for s in (1,2,3)])
k=[(c*28*3)//4 for c in (1,2,4,7,14)];print("28:",k,sum(k),"proper divisors",divs(28)[:-1],sum(divs(28)[:-1]))
print("28 rehearsal per-knife floor:",[x//2 for x in k],sum(x//2 for x in k),"vs total//2",sum(k)//2)
print("28 formula order n=29:",[(c*29*3)//4 for c in (1,2,4,7,14)],[c*((29*3)//4) for c in (1,2,4,7,14)])
print("30:",[150*s for s in (1,2,3)],[75*s for s in(1,2,3)],"36:",[288*s for s in (1,2,3)],[144*s for s in (1,2,3)])
print("36 coin candidates:",divs(36)[:-1],"÷2→18:",divs(18)[:-1],"÷3→12:",divs(12)[:-1])
print("6 perfect:",sum(divs(6)[:-1]))
print("\n# per-beat equivalent song power (coef) by unit")
coef={2:2*7,3:14,4:'6 x up to 3 targets = 18',5:12,6:12,7:14,8:16,9:16,10:'8 x up to 2',11:16,13:13*2,16:8+4+2+1,21:21,28:sum(k)/28}
print(coef)
print("\n# economy")
print("pool",6*18+6*15+5*12+4*10+3*9)
odds=[[75,25,0,0,0],[55,35,10,0,0],[40,35,20,5,0],[25,35,28,10,2],[15,25,33,20,7],[10,18,30,28,14]]
print("odds sums",[sum(o) for o in odds])
need=[2,6,10,16,24];cum=[sum(need[:i+1]) for i in range(5)];print("cum xp",cum)
xp=0;lv=3
for r in range(1,13):
    if r>=2: xp+=2
    while lv<8 and xp>=cum[lv-3]: lv+=1
    print(f"R{r}:xp{xp} L{lv}",end='; ')
print()
print("interest 27,12:",divmod(27,10),divmod(12,10))
# stone supply range
from itertools import product as P
res=set()
for r6 in [(0,1),(2,0),(0,0)]:
  for r10 in [(1,1),(0,0),(2,0)]:
    for cons in (0,1):
      res.add((2+r6[0]+r10[0]+cons, r6[1]+r10[1]))
print("stones/treasures per game (stones,treasures):",sorted(res), "stones range",min(s for s,_ in res),max(s for s,_ in res))
print("\n# power preservation: total song power until beat T = n*coef*floor(T/n); ratio to coef*T")
for T in (24,30,34,48):
    print("T",T,{n:round(n*(T//n)/T,2) for n in [5,9,10,12,16,17,18,20,21,23,24,25,28,30,32,36]})
print("examples ±1/×: 24→25 @T48",24*(48//24),25*(48//25),"| 9→18 @T30",9*(30//9),18*(30//18),"| 12→36 @T30",12*(30//12),36*(30//36),"(+rehearsal 18)")
print("\n# 단단 solo beats (1 absent)")
for deck in ([2,3,5,7,11,13],[3,5,7,11,13,17],[2,3,5,7,11,13,17,4]):
    solo={n:[t for t in range(1,49) if t%n==0 and [d for d in deck if t%d==0]==[n]] for n in deck if n in designFam['단단']}
    print(deck,{n:len(v) for n,v in solo.items()},"total solo",sum(len(v) for v in solo.values()), "within 30 beats",sum(1 for v in solo.values() for t in v if t<=30))
print("\nchorus deck 1,2,3,4,6,12,24,36 beats with k>=2 within 48:",sum(1 for t in range(1,49) if len([d for d in [1,2,3,4,6,12,24,36] if t%d==0])>=2))
