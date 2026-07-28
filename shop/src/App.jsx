import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:3001";
const SIZES = ["36","37","38","39","40","41"];
const n = v => Number(v || 0);

const money = value =>
  n(value).toLocaleString("tr-TR", {
    style:"currency",
    currency:"TRY",
    maximumFractionDigits:0
  });

function imageUrl(path) {
  if (!path) return "";

  return path.startsWith("/uploads/")
    ? API+path
    : path;
}

function totalStock(product) {
  return (product.colors || []).reduce(
    (sum,color) =>
      sum +
      Object.values(color.sizes || {})
        .reduce(
          (s,v) => s+n(v),
          0
        ),
    0
  );
}

function salePrice(product) {
  if (product.salePrice!=null) {
    return n(product.salePrice);
  }

  const discount =
    Math.max(
      0,
      Math.min(100,n(product.discount))
    );

  return Math.round(
    (
      n(product.price) *
      (1-discount/100)
    ) * 100
  ) / 100;
}

function firstImage(product) {
  return (
    product.colors?.[0]?.images?.[0] ||
    product.colors?.[0]?.image ||
    product.image ||
    ""
  );
}

export default function App() {
  const [authToken,setAuthToken]=useState(()=>localStorage.getItem("sheliva-token")||"");
  const [authUser,setAuthUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [otpSent,setOtpSent]=useState(false);

  const [toast,setToast]=useState(null);
  const [accountOpen,setAccountOpen]=useState(false);

  const [savedAddress,setSavedAddress]=useState(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem("sheliva-saved-address") || "null"
        );
      } catch {
        return null;
      }
    }
  );
  const [products,setProducts] =
    useState([]);

  const [loading,setLoading] =
    useState(true);

  const [connected,setConnected] =
    useState(false);

  const [page,setPage] =
    useState("home");

  const [selected,setSelected] =
    useState(null);

  const [selectedColor,setSelectedColor] =
    useState(null);

  const [selectedSize,setSelectedSize] =
    useState(null);

  const [activePhoto,setActivePhoto] =
    useState("");

  const [filter,setFilter] =
    useState("Tümü");

  const [search,setSearch] =
    useState("");

  const [cart,setCart] =
    useState(
      () =>
        JSON.parse(
          localStorage.getItem(
            "sheliva-cart-v3"
          ) || "[]"
        )
    );

  const [cartOpen,setCartOpen] =
    useState(false);

  const [checkout,setCheckout] =
    useState(false);

  const [orderSuccess,setOrderSuccess] =
    useState(null);

  const [settings,setSettings]=useState({});
  const [productTab,setProductTab]=useState("features");
  const [productReviews,setProductReviews]=useState([]);
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewSent,setReviewSent]=useState(false);

  async function refreshProducts() {
    try {
      const res =
        await fetch(
          `${API}/api/products`
        );

      if (!res.ok) {
        throw new Error();
      }

      setProducts(
        (await res.json())
          .filter(
            p => p.active!==false
          )
      );

      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    refreshProducts();

    const timer =
      setInterval(
        refreshProducts,
        2000
      );

    return () =>
      clearInterval(timer);
  },[]);

  useEffect(()=>{
    localStorage.setItem(
      "sheliva-cart-v3",
      JSON.stringify(cart)
    );
  },[cart]);

  useEffect(()=>{
    loadAuthUser();
  },[authToken]);

  useEffect(()=>{
    fetch(`${API}/api/settings`)
      .then(r=>r.ok?r.json():{})
      .then(setSettings)
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!selected?.id){
      setProductReviews([]);
      return;
    }

    fetch(`${API}/api/products/${selected.id}/reviews`)
      .then(r=>r.ok?r.json():[])
      .then(setProductReviews)
      .catch(()=>setProductReviews([]));
  },[selected?.id]);

  const filtered =
    useMemo(()=>{
      let list =
        [...products];

      if (filter==="Yazlık") {
        list =
          list.filter(
            p => p.category==="Yazlık"
          );
      }

      if (filter==="Kışlık") {
        list =
          list.filter(
            p => p.category==="Kışlık"
          );
      }

      if (filter==="Yeni Sezon") {
        list =
          list.filter(
            p => p.newest!==false
          );
      }

      if (filter==="İndirimde") {
        list =
          list.filter(
            p => n(p.discount)>0
          );
      }

      if (filter==="Son Gelenler") {
        list =
          [...list].sort(
            (a,b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          );
      }

      if (search.trim()) {
        list =
          list.filter(
            p =>
              p.name
                .toLocaleLowerCase("tr")
                .includes(
                  search
                    .toLocaleLowerCase("tr")
                )
          );
      }

      return list;
    },[
      products,
      filter,
      search
    ]);

  const cartCount =
    cart.reduce(
      (s,item) =>
        s+n(item.qty),
      0
    );

  const cartTotal =
    cart.reduce(
      (s,item) =>
        s+n(item.price)*n(item.qty),
      0
    );

  const checkoutCargoFee =
    cartTotal>0 &&
    cartTotal<n(settings.freeShippingThreshold)
      ? n(settings.cargoFee)
      : 0;

  const checkoutGrandTotal =
    cartTotal + checkoutCargoFee;

  const freeShippingRemaining =
    Math.max(0,n(settings.freeShippingThreshold)-cartTotal);

  const discounted =
    products.filter(
      p =>
        n(p.discount)>0 &&
        totalStock(p)>0
    );

  const bestSellers =
    [...products]
      .filter(
        p => totalStock(p)>0
      )
      .sort(
        (a,b) =>
          n(b.totalSold) -
          n(a.totalSold)
      );

  const promoProduct =
    discounted[0] ||
    bestSellers[0] ||
    products[0];

  const bestseller =
    bestSellers[0] ||
    discounted[0] ||
    products[0];

  function showToast(message,detail="",type="success") {
    setToast({message,detail,type});

    setTimeout(()=>{
      setToast(null);
    },3200);
  }

  function saveAddressFromForm(form) {
    const address = {
      name:form.get("name") || "",
      phone:form.get("phone") || "",
      email:form.get("email") || "",
      city:form.get("city") || "",
      district:form.get("district") || "",
      neighborhood:form.get("neighborhood") || "",
      postalCode:form.get("postalCode") || "",
      address:form.get("address") || ""
    };

    setSavedAddress(address);

    localStorage.setItem(
      "sheliva-saved-address",
      JSON.stringify(address)
    );
  }

  function clearSavedAddress() {
    if(!window.confirm("Kayıtlı teslimat adresi silinsin mi?")) return;

    setSavedAddress(null);
    localStorage.removeItem("sheliva-saved-address");
  }

  function openProduct(product) {
    const color =
      product.colors?.[0] ||
      null;

    setSelected(product);
    setSelectedColor(color);
    setSelectedSize(null);

    setActivePhoto(
      color?.images?.[0] ||
      color?.image ||
      product.image ||
      ""
    );

    setPage("product");
    window.scrollTo(0,0);
  }

  function goHome(category="Tümü") {
    setPage("home");
    setFilter(category);

    setTimeout(()=>{
      if (category==="Tümü") {
        window.scrollTo({
          top:0,
          behavior:"smooth"
        });
      } else {
        document
          .querySelector("#products")
          ?.scrollIntoView({
            behavior:"smooth"
          });
      }
    },50);
  }

  function addToCart() {
    if (!selectedColor) {
      return alert("Renk seç.");
    }

    if (!selectedSize) {
      return alert("Numara seç.");
    }

    const stock =
      n(
        selectedColor
          .sizes?.[String(selectedSize)]
      );

    if (stock<=0) {
      return alert(
        "Bu numara tükendi."
      );
    }

    const key =
      `${selected.id}-${selectedColor.id}-${selectedSize}`;

    setCart(prev => {
      const found =
        prev.find(
          item =>
            item.key===key
        );

      if (found) {
        if (found.qty>=stock) {
          return prev;
        }

        return prev.map(
          item =>
            item.key===key
              ? {
                  ...item,
                  qty:item.qty+1,
                  maxStock:stock
                }
              : item
        );
      }

      return [
        ...prev,
        {
          key,
          productId:selected.id,
          name:selected.name,

          colorId:selectedColor.id,
          colorName:selectedColor.name,

          size:selectedSize,

          image:
            selectedColor.images?.[0] ||
            selectedColor.image ||
            selected.image,

          listPrice:n(selected.price),
          discount:n(selected.discount),
          price:salePrice(selected),

          qty:1,
          maxStock:stock
        }
      ];
    });

    showToast(
      "Ürün başarıyla sepetine eklendi",
      `${selected.name} • ${selectedColor.name} • ${selectedSize} numara`
    );
  }

  function changeQty(key,delta) {
    setCart(
      prev =>
        prev
          .map(item => {
            if (item.key!==key) {
              return item;
            }

            const product =
              products.find(
                p =>
                  Number(p.id) ===
                  Number(item.productId)
              );

            const color =
              product?.colors?.find(
                c => c.id===item.colorId
              );

            const stock =
              n(
                color
                  ?.sizes?.[String(item.size)]
              );

            const next =
              item.qty+delta;

            if (
              delta>0 &&
              next>stock
            ) {
              return item;
            }

            return {
              ...item,
              qty:next,
              maxStock:stock
            };
          })
          .filter(
            item => item.qty>0
          )
    );
  }

  async function submitReview(event){
    event.preventDefault();

    if(!authToken){
      setAuthOpen(true);
      setAuthMode("login");
      return;
    }

    const form=new FormData(event.currentTarget);
    const text=String(form.get("reviewText")||"").trim();

    if(!text){
      return showToast("Yorum yazmalısın.","","error");
    }

    const res=await fetch(`${API}/api/reviews`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:`Bearer ${authToken}`
      },
      body:JSON.stringify({
        productId:selected.id,
        rating:reviewRating,
        text,
        anonymous:form.get("anonymous")==="on"
      })
    });

    const data=await res.json();

    if(!res.ok){
      return showToast("Yorum gönderilemedi",data.error||"","error");
    }

    event.currentTarget.reset();
    const reviewBox=event.currentTarget.querySelector('textarea[name="reviewText"]');
    if(reviewBox) reviewBox.value="";
    setReviewRating(5);
    setReviewSent(true);
    setTimeout(()=>setReviewSent(false),4200);
    showToast("Yorum gönderildi","Yönetici onayından sonra yayınlanacak.");
  }

  async function placeOrder(event) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    const body = {
      source:"SHELIVA Web",

      cargoFee:
        n(form.get("cargoFee")),

      paymentMethod:
        form.get("paymentMethod"),

      paymentStatus:"Bekliyor",

      customer:{
        name:form.get("name"),
        phone:form.get("phone"),
        email:form.get("email"),

        city:form.get("city"),
        district:form.get("district"),
        neighborhood:form.get("neighborhood"),
        postalCode:form.get("postalCode"),

        address:form.get("address"),
        note:form.get("note")
      },

      items:cart
    };

    const res =
      await fetch(
        `${API}/api/orders`,
        {
          method:"POST",

          headers:{
            "Content-Type":"application/json",
            ...(authToken ? {Authorization:`Bearer ${authToken}`} : {})
          },

          body:
            JSON.stringify(body)
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error ||
        "Sipariş oluşturulamadı."
      );
    }

    setOrderSuccess(data);
    setCart([]);

    if(authUser){
      saveAddressFromForm(form);
    }

    await refreshProducts();
  }

  async function loadAuthUser(token=authToken) {
    if(!token){setAuthUser(null);return}
    try{
      const res=await fetch(`${API}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok){localStorage.removeItem("sheliva-token");setAuthToken("");setAuthUser(null);return}
      setAuthUser(await res.json());
    }catch{setAuthUser(null)}
  }

  async function loginUser(event) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const res=await fetch(`${API}/api/auth/login`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({login:form.get("login"),password:form.get("password")})
    });
    const data=await res.json();
    if(!res.ok)return alert(data.error||"Giriş yapılamadı.");
    localStorage.setItem("sheliva-token",data.token);
    setAuthToken(data.token);setAuthUser(data.user);setAuthOpen(false);
  }

  async function registerUser(event) {
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const res=await fetch(`${API}/api/auth/register-simple`,{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:form.get("name"),phone:form.get("phone"),email:form.get("email"),password:form.get("password")})
    });
    const data=await res.json();
    if(!res.ok)return alert(data.error||"Hesap oluşturulamadı.");
    localStorage.setItem("sheliva-token",data.token);
    setAuthToken(data.token);setAuthUser(data.user);setAuthOpen(false);
    alert("SHELİVA hesabın oluşturuldu.");
  }

  async function logoutUser() {
    if(!window.confirm("Hesaptan çıkış yapılsın mı?"))return;
    if(authToken){try{await fetch(`${API}/api/auth/logout`,{method:"POST",headers:{Authorization:`Bearer ${authToken}`}})}catch{}}
    localStorage.removeItem("sheliva-token");setAuthToken("");setAuthUser(null);
  }

  if (loading) {
    return (
      <div className="loading">
        SHELİVA
      </div>
    );
  }

  return (
    <div className="site">

      <header className="header">

        <button
          className="menu"
          onClick={()=>goHome()}
        >
          ☰
          {" "}
          <small>MENU</small>
        </button>

        <button
          className="brand"
          onClick={()=>goHome()}
        >
          SHELİVA
        </button>

        <div className="headerIcons">

          <div className="headerSearch">
            ⌕
            <input
              placeholder="Ara"
              value={search}
              onChange={e=>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <button
            className="headerAccount"
            onClick={()=>
              authUser
                ? setAccountOpen(true)
                : setAuthOpen(true)
            }
          >
            {authUser ? "HESABIM" : "GİRİŞ / ÜYE OL"}
          </button>

          <button
            className="headerCart"
            onClick={()=>
              setCartOpen(true)
            }
          >
            🛍

            <span>
              {cartCount}
            </span>
          </button>

        </div>

      </header>

      {!connected && (
        <div className="serverWarning">
          Sunucu bağlantısı yok.
        </div>
      )}

      {page==="home" && (
        <main className="homeMain">

          <section className="heroBanner heroTop">

            <div className="heroPhoto">
              <img
                src={
                  promoProduct
                    ? imageUrl(
                        firstImage(promoProduct)
                      )
                    : "/products/yazlik-2.png"
                }
              />
            </div>

            <div className="heroBlack">

              <h1>
                {promoProduct
                  ? n(promoProduct.discount)>0
                    ? "İndirimde Öne Çıkan"
                    : "Özelleştirilmiş Koleksiyon"
                  : "Özelleştirilmiş Koleksiyon"}
              </h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {promoProduct
                  ? promoProduct.name
                  : "YAZ 2026"}
              </span>

              {promoProduct && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(promoProduct)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

          </section>

          <section className="heroBanner heroBottom">

            <div className="heroBlack">

              <h1>En Çok Satan</h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {bestseller
                  ? bestseller.name
                  : "SUMMER COLLECTION"}
              </span>

              {bestseller && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(bestseller)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

            <div className="heroPhoto">
              <img
                src={
                  bestseller
                    ? imageUrl(
                        firstImage(bestseller)
                      )
                    : "/products/yazlik-1.png"
                }
              />
            </div>

          </section>

          <section className="categoryGrid">

            {[
              [
                "YAZLIK",
                "Yazlık",
                "/products/yazlik-2.png"
              ],
              [
                "KIŞLIK",
                "Kışlık",
                "/products/kislik-2.png"
              ],
              [
                "YENİ SEZON",
                "Yeni Sezon",
                "/products/yazlik-4.png"
              ],
              [
                "İNDİRİMDE",
                "İndirimde",
                discounted[0]
                  ? imageUrl(
                      firstImage(discounted[0])
                    )
                  : "/products/kislik-4.png"
              ],
              [
                "TÜM ÜRÜNLER",
                "Tümü",
                "/products/yazlik-1.png"
              ],
              [
                "SON GELENLER",
                "Son Gelenler",
                "/products/kislik-3.png"
              ]
            ].map(
              ([title,key,img]) => (
                <button
                  key={title}
                  onClick={()=>
                    goHome(key)
                  }
                >
                  <img src={img}/>
                  <strong>{title}</strong>
                  <span>by SHELİVA</span>
                </button>
              )
            )}

          </section>

          <section
            id="products"
            className="products"
          >

            <div className="productsTitle">
              <span>SHELİVA</span>

              <h2>
                {filter==="Tümü"
                  ? "Tüm Ürünler"
                  : filter}
              </h2>
            </div>

            {!filtered.length ? (
              <div className="noProducts">
                Henüz ürün eklenmedi.
                <small>
                  Ürünler yönetim panelinden eklenir.
                </small>
              </div>
            ) : (
              <div className="productsGrid">

                {filtered.map(
                  product => (
                    <article
                      className="productCard"
                      key={product.id}
                      onClick={()=>
                        openProduct(product)
                      }
                    >

                      <div className="productImg">

                        {firstImage(product) ? (
                          <img
                            src={
                              imageUrl(
                                firstImage(product)
                              )
                            }
                          />
                        ) : (
                          <div className="noImage">
                            SHELİVA
                          </div>
                        )}

                        {n(product.discount)>0 && (
                          <span className="saleTag">
                            %{product.discount}
                          </span>
                        )}

                      </div>

                      <div className="productCardText">

                        <small>
                          {product.category}
                        </small>

                        <h3>
                          {product.name}
                        </h3>

                        <div className="priceArea">

                          {n(product.discount)>0 && (
                            <del>
                              {money(product.price)}
                            </del>
                          )}

                          <strong>
                            {money(
                              salePrice(product)
                            )}
                          </strong>

                        </div>

                        <span
                          className={
                            totalStock(product)>0
                              ? "stockAvailable"
                              : "stockOut"
                          }
                        >
                          {totalStock(product)>0
                            ? `${totalStock(product)} adet stok`
                            : "Tükendi"}
                        </span>

                        <button
                          disabled={
                            totalStock(product)<=0
                          }
                        >
                          {totalStock(product)>0
                            ? "ÜRÜNÜ İNCELE"
                            : "TÜKENDİ"}
                        </button>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

        </main>
      )}

      {page==="product" && selected && (
        <main className="productPage">

          <div className="breadcrumb">

            <button
              onClick={()=>goHome()}
            >
              Ana Sayfa
            </button>

            <span>/</span>

            <b>
              {selected.name}
            </b>

          </div>

          <section className="detailTop v3Product">

            <div className="galleryV3">

              <div className="thumbsV3">

                {(
                  selectedColor?.images ||
                  (
                    selectedColor?.image
                      ? [selectedColor.image]
                      : []
                  )
                ).map(
                  (img,index) => (
                    <button
                      key={index}
                      className={
                        activePhoto===img
                          ? "active"
                          : ""
                      }
                      onClick={()=>
                        setActivePhoto(img)
                      }
                    >
                      <img
                        src={
                          imageUrl(img)
                        }
                      />
                    </button>
                  )
                )}

              </div>

              <div className="mainPhotoV3">

                {activePhoto ? (
                  <img
                    src={
                      imageUrl(activePhoto)
                    }
                  />
                ) : (
                  <div className="noImage">
                    SHELİVA
                  </div>
                )}

              </div>

            </div>

            <div className="detailInfo">

              <small>
                {selected.quality || "SHELİVA"}
              </small>

              <h1>
                {selected.name}
              </h1>

              <div className="detailPriceV3">

                <div>

                  {n(selected.discount)>0 && (
                    <del>
                      {money(selected.price)}
                    </del>
                  )}

                  <strong>
                    {money(
                      salePrice(selected)
                    )}
                  </strong>

                </div>

                {n(selected.discount)>0 && (
                  <span>
                    %{selected.discount} İndirim
                  </span>
                )}

              </div>

              <div className="optionBlock">

                <label>RENK</label>

                <div className="colorSelector">

                  {(selected.colors||[])
                    .map(color => (
                      <button
                        key={color.id}
                        className={
                          selectedColor?.id===color.id
                            ? "active"
                            : ""
                        }
                        onClick={()=>{
                          setSelectedColor(color);
                          setSelectedSize(null);
                          setActivePhoto(
                            color.images?.[0] ||
                            color.image ||
                            ""
                          );
                        }}
                      >

                        {(color.images?.[0] || color.image) && (
                          <img
                            src={
                              imageUrl(
                                color.images?.[0] ||
                                color.image
                              )
                            }
                          />
                        )}

                        <span>
                          {color.name}
                        </span>

                      </button>
                    ))}

                </div>

              </div>

              <div className="optionBlock">

                <label>NUMARA</label>

                <div className="sizes">

                  {SIZES.map(size => {
                    const stock =
                      n(
                        selectedColor
                          ?.sizes?.[size]
                      );

                    return (
                      <button
                        key={size}
                        disabled={stock<=0}
                        className={
                          String(selectedSize)===size
                            ? "active"
                            : ""
                        }
                        onClick={()=>
                          setSelectedSize(size)
                        }
                      >
                        {size}

                        <small>
                          {stock>0
                            ? `${stock} adet`
                            : "Yok"}
                        </small>
                      </button>
                    );
                  })}

                </div>

              </div>

              <button
                className="addButton"
                disabled={
                  !selectedColor ||
                  !selectedSize ||
                  n(
                    selectedColor
                      ?.sizes?.[String(selectedSize)]
                  )<=0
                }
                onClick={addToCart}
              >
                {!selectedSize
                  ? "NUMARA SEÇ"
                  : n(
                      selectedColor
                        ?.sizes?.[String(selectedSize)]
                    )<=0
                    ? "TÜKENDİ"
                    : "SEPETE EKLE"}
              </button>

              <div className="productMeta">

                <span>
                  Stok:
                  {" "}
                  <b>
                    {totalStock(selected)}
                  </b>
                </span>

                <span>
                  İndirimli fiyat otomatik hesaplanır.
                </span>

              </div>

            </div>

          </section>

          <section className="productTabsPro">

            <div className="productTabsNav">
              {[
                ["features","ÜRÜN ÖZELLİKLERİ"],
                ["reviews",`YORUMLAR (${productReviews.length})`],
                ["payment","ÖDEME SEÇENEKLERİ"],
                ["shipping","KARGO, DEĞİŞİM VE İADELER"],
                ["faq","S.S.S."]
              ].map(([key,label])=>(
                <button
                  key={key}
                  className={productTab===key ? "active" : ""}
                  onClick={()=>setProductTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="productTabContent">
              {productTab==="features" && (
                <div>
                  <h3>{selected.name}</h3>
                  <p>{selected.description || "Ürün açıklaması yakında eklenecek."}</p>

                  {selected.features && <div className="richTextBlock">{selected.features}</div>}
                </div>
              )}

              {productTab==="reviews" && (
                <div className="reviewsArea">
                  <div className="reviewList">
                    {!productReviews.length && <p>Bu ürün için henüz onaylanmış yorum yok.</p>}
                    {productReviews.map(review=>(
                      <article key={review.id} className="customerReview">
                        <div><b>{review.userName || "Müşteri"}</b><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>
                        <p>{review.text}</p>
                        <small>{new Date(review.createdAt).toLocaleDateString("tr-TR")}</small>
                      </article>
                    ))}
                  </div>

                  <form className="reviewForm" onSubmit={submitReview}>
                    <h3>Yorum Yaz</h3>
                    {!authUser && <p>Yorum göndermek için giriş yapman gerekir.</p>}
                    <div className="ratingPicker">
                      {[1,2,3,4,5].map(star=>(
                        <button type="button" key={star} className={star<=reviewRating ? "active" : ""} onClick={()=>setReviewRating(star)}>★</button>
                      ))}
                    </div>
                    <textarea name="reviewText" placeholder="Ürün hakkındaki deneyimini yaz..." required/>
                    <label className="anonymousReviewOption">
                      <input type="checkbox" name="anonymous"/>
                      <span>
                        <b>Adımı ve bilgilerimi gizle</b>
                        <small>Yayınlandığında adın yerine "Gizli Kullanıcı" görünür.</small>
                      </span>
                    </label>
                    <button type="submit">YORUMU GÖNDER</button>
                    {reviewSent && <div className="reviewSentMessage">✓ Yorum gönderildi. Onaydan sonra yayınlanacak.</div>}
                    <small>Yorumun yönetici onayından sonra yayınlanır.</small>
                  </form>
                </div>
              )}

              {productTab==="payment" && (
                <div>
                  <h3>Ödeme Seçenekleri</h3>
                  <p>{selected.paymentInfo || "Kredi/Banka Kartı ve Havale/EFT seçenekleri kullanılabilir."}</p>
                  {settings.iban && (
                    <div className="ibanBox">
                      <span>{settings.bankName || "Banka"}</span>
                      <b>{settings.iban}</b>
                      <small>{settings.accountHolder || "SHELİVA"}</small>
                    </div>
                  )}
                </div>
              )}


              {productTab==="shipping" && (
                <div><h3>Kargo, Değişim ve İadeler</h3><p>{selected.shippingReturns || "Gönderimler Aras Kargo ile yapılır. Detaylı koşullar yönetim panelinden düzenlenebilir."}</p></div>
              )}

              {productTab==="faq" && (
                <div><h3>Sık Sorulan Sorular</h3><p>{selected.faq || "Sık sorulan sorular yakında eklenecek."}</p></div>
              )}
            </div>

          </section>

        </main>
      )}

      <footer className="siteFooter">
        <div className="footerTop">
          <section className="footerBrand">
            <h2>SHELİVA</h2>
            <p>Modern çizgiler, seçilmiş modeller ve detaylı üretim.</p>
            <div className="socialLinks">{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">INSTAGRAM</a>}{settings.tiktokUrl && <a href={settings.tiktokUrl} target="_blank" rel="noreferrer">TIKTOK</a>}{settings.youtubeUrl && <a href={settings.youtubeUrl} target="_blank" rel="noreferrer">YOUTUBE</a>}{settings.whatsappUrl && <a href={settings.whatsappUrl} target="_blank" rel="noreferrer">WHATSAPP</a>}</div>
          </section>

          <section>
            <b>ALIŞVERİŞ</b>
            <button onClick={()=>goHome("Yazlık")}>Yazlık</button>
            <button onClick={()=>goHome("Kışlık")}>Kışlık</button>
            <button onClick={()=>goHome("İndirimde")}>İndirimde</button>
            <button onClick={()=>goHome("Son Gelenler")}>Son Gelenler</button>
          </section>

          <section><b>MÜŞTERİ</b><span>Sipariş Takibi</span><span>Kargo & Teslimat</span><span>İade / Değişim</span><span>Gizlilik</span></section>
          <section><b>SHELİVA</b><span>Hakkımızda</span><span>İletişim</span><span>Üretim</span><span>Sık Sorulan Sorular</span></section>
        </div>

        <div className="footerBottom"><span>© 2026 SHELİVA</span><span>Güvenli alışveriş • Gerçek stok</span></div>
      </footer>

      {authOpen && (
        <div className="authOverlay">
          <div className="authModal">
            <div className="authHead">
              <div><small>SHELİVA</small><h2>{authMode==="login" ? "Giriş Yap" : "Üye Ol"}</h2></div>
              <button onClick={()=>setAuthOpen(false)}>×</button>
            </div>

            <div className="authTabs">
              <button className={authMode==="login"?"active":""} onClick={()=>setAuthMode("login")}>GİRİŞ</button>
              <button className={authMode==="register"?"active":""} onClick={()=>setAuthMode("register")}>ÜYE OL</button>
            </div>

            {authMode==="login" ? (
              <form className="authForm" onSubmit={loginUser}>
                <label>Telefon veya E-posta<input name="login" required placeholder="05xx... veya e-posta"/></label>
                <label>Şifre<input name="password" type="password" required placeholder="Şifren"/></label>
                <button>GİRİŞ YAP</button>
              </form>
            ) : (
              <form className="authForm" onSubmit={registerUser}>
                <label>Ad Soyad<input name="name" required placeholder="Ad Soyad" defaultValue={savedAddress?.name || authUser?.name || ""}/></label>
                <label>Telefon<input name="phone" required placeholder="05xx xxx xx xx"/></label>
                <label>E-posta<input name="email" type="email" required placeholder="mail@ornek.com"/></label>
                <label>Şifre<input name="password" type="password" required minLength="6" placeholder="En az 6 karakter"/></label>
                <div className="verifyLater">Telefon doğrulaması daha sonra SMS sistemine bağlanacak.</div>
                <button>HESAP OLUŞTUR</button>
              </form>
            )}
          </div>
        </div>
      )}

      {accountOpen && authUser && (
        <div className="accountOverlay">

          <div className="accountPanel">

            <div className="accountHead">

              <div>
                <small>SHELİVA HESABIM</small>
                <h2>{authUser.name}</h2>
                <span>{authUser.email}</span>
              </div>

              <button
                onClick={()=>
                  setAccountOpen(false)
                }
              >
                ×
              </button>

            </div>

            <div className="accountMenuGrid">

              <section className="accountMenuCard">
                <b>PROFİL BİLGİLERİ</b>

                <span>{authUser.name}</span>
                <span>{authUser.phone}</span>
                <span>{authUser.email}</span>
              </section>

              <section className="accountMenuCard addressCard">

                <div className="accountCardTitle">
                  <b>TESLİMAT ADRESİM</b>

                  {savedAddress && (
                    <button
                      onClick={clearSavedAddress}
                    >
                      SİL
                    </button>
                  )}
                </div>

                {savedAddress ? (
                  <>
                    <strong>
                      {savedAddress.name}
                    </strong>

                    <p>
                      {savedAddress.neighborhood
                        ? `${savedAddress.neighborhood}, `
                        : ""}
                      {savedAddress.address}
                    </p>

                    <span>
                      {savedAddress.district}
                      {" / "}
                      {savedAddress.city}
                    </span>

                    <span>
                      {savedAddress.phone}
                    </span>

                    <small>
                      Bir sonraki siparişte bu bilgiler
                      otomatik doldurulur.
                    </small>
                  </>
                ) : (
                  <>
                    <p>
                      Henüz kayıtlı teslimat adresin yok.
                    </p>

                    <small>
                      İlk siparişinde adresini gir.
                      Siparişten sonra otomatik kaydedilecek.
                    </small>
                  </>
                )}

              </section>

              <section className="accountMenuCard">
                <b>SİPARİŞLERİM</b>
                <p>
                  Sipariş geçmişi ve takip sistemi
                  bir sonraki aşamada burada olacak.
                </p>
              </section>

              <section className="accountMenuCard">
                <b>GÜVENLİK</b>
                <p>
                  Şifre ve telefon doğrulama ayarları.
                </p>
              </section>

            </div>

            <div className="accountFooter">

              <button
                className="logoutButton"
                onClick={()=>{
                  setAccountOpen(false);
                  logoutUser();
                }}
              >
                ÇIKIŞ YAP
              </button>

            </div>

          </div>

        </div>
      )}

      {toast && (
        <div
          className={
            `shopToast ${toast.type || "success"}`
          }
        >
          <div className="toastCheck">
            ✓
          </div>

          <div className="toastText">
            <b>{toast.message}</b>
            <span>{toast.detail}</span>
          </div>

          <button
            onClick={()=>{
              setToast(null);
              setCartOpen(true);
            }}
          >
            SEPETE GİT
          </button>

          <button
            className="toastClose"
            onClick={()=>
              setToast(null)
            }
          >
            ×
          </button>
        </div>
      )}
      <div
        className={
          cartOpen
            ? "drawerShade show"
            : "drawerShade"
        }
        onClick={()=>
          setCartOpen(false)
        }
      ></div>

      <aside
        className={
          cartOpen
            ? `sideDrawer open ${checkout ? "checkoutMode" : ""}`
            : "sideDrawer"
        }
      >

        <div className="drawerHead">

          <h2>
            Sepetim ({cartCount})
          </h2>

          <button
            onClick={()=>
              setCartOpen(false)
            }
          >
            ×
          </button>

        </div>

        {!checkout ? (
          <>

            <div className="drawerContent">

              {!cart.length && (
                <div className="emptyCartPro">

                  <div className="emptyCartIcon">
                    🛍
                  </div>

                  <h3>Sepetin boş.</h3>

                  <p>
                    Beğendiğin ürünleri sepete ekleyerek
                    alışverişine başlayabilirsin.
                  </p>

                  <button
                    onClick={()=>{
                      setCartOpen(false);
                      setCheckout(false);
                      goHome("Tümü");

                      setTimeout(()=>{
                        document
                          .querySelector("#products")
                          ?.scrollIntoView({
                            behavior:"smooth"
                          });
                      },100);
                    }}
                  >
                    Sepetine Yeni Ürünler Eklemek İçin Tıkla
                  </button>

                  <div className="emptyCartBenefits">
                    <span>✓ Gerçek stok</span>
                    <span>✓ Güvenli alışveriş</span>
                    <span>✓ Kolay sipariş</span>
                  </div>

                </div>
              )}

              {cart.map(item => (
                <div
                  className="drawerItem"
                  key={item.key}
                >

                  <img
                    src={
                      imageUrl(item.image)
                    }
                  />

                  <div>

                    <h4>{item.name}</h4>

                    <p>
                      {item.colorName}
                      {" • "}
                      {item.size}
                    </p>

                    <strong>
                      {money(
                        item.price *
                        item.qty
                      )}
                    </strong>

                    <div className="drawerQty">

                      <button
                        onClick={()=>
                          changeQty(
                            item.key,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <span>
                        {item.qty}
                      </span>

                      <button
                        disabled={
                          item.qty>=item.maxStock
                        }
                        onClick={()=>
                          changeQty(
                            item.key,
                            1
                          )
                        }
                      >
                        +
                      </button>

                    </div>

                    <small className="stockHint">
                      Maks. {item.maxStock} adet
                    </small>

                  </div>

                  <button
                    className="remove"
                    onClick={()=>
                      setCart(
                        cart.filter(
                          x => x.key!==item.key
                        )
                      )
                    }
                  >
                    ×
                  </button>

                </div>
              ))}

            </div>

            {!!cart.length && (
              <div className="drawerBottom">


                <div className="freeShippingCartNotice">
                  {n(settings.freeShippingThreshold)>0 ? (
                    cartTotal>=n(settings.freeShippingThreshold) ? (
                      <b>✓ Ücretsiz kargo hakkın aktif.</b>
                    ) : (
                      <>
                        <b>{money(settings.freeShippingThreshold)} ve üzeri ücretsiz kargo</b>
                        <span>Ücretsiz kargo için {money(freeShippingRemaining)} daha ekle.</span>
                      </>
                    )
                  ) : null}
                </div>

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(cartTotal)}
                  </strong>
                </div>

                <button
                  onClick={()=>
                    setCheckout(true)
                  }
                >
                  SİPARİŞİ ONAYLA
                </button>

              </div>
            )}

          </>
        ) : (
          <form
            className="checkoutForm"
            onSubmit={placeOrder}
          >

            {!orderSuccess ? (
              <>

                <button
                  type="button"
                  onClick={()=>
                    setCheckout(false)
                  }
                >
                  ← Sepete dön
                </button>

                <div className="checkoutHeading">
                  <small>SHELİVA CHECKOUT</small>
                  <h2>Ödeme ve Teslimat</h2>
                  <p>Siparişini tamamlamak için bilgilerini kontrol et.</p>
                </div>

                <h3>Teslimat Bilgileri</h3>

                {!authUser && (
                  <div className="guestCheckoutInfo">
                    <div>
                      <b>Üye olmadan devam edebilirsin.</b>
                      <span>Hesap oluşturursan siparişlerini daha sonra hesabından takip edebilirsin.</span>
                    </div>
                    <button type="button" onClick={()=>setAuthOpen(true)}>ÜYE OL / GİRİŞ YAP</button>
                  </div>
                )}

                <input
                  name="name"
                  required
                  placeholder="Ad Soyad" defaultValue={savedAddress?.name || authUser?.name || ""}
                />

                <input
                  name="phone"
                  required
                  placeholder="Telefon" defaultValue={savedAddress?.phone || authUser?.phone || ""}
                />

                <input
                  name="email"
                  type="email"
                  required
                  placeholder="E-posta" defaultValue={savedAddress?.email || authUser?.email || ""}
                />

                <div className="checkoutTwo">

                  <input
                    name="city"
                    required
                    placeholder="İl" defaultValue={savedAddress?.city || ""}
                  />

                  <input
                    name="district"
                    required
                    placeholder="İlçe" defaultValue={savedAddress?.district || ""}
                  />

                </div>

                <div className="checkoutTwo">

                  <input
                    name="neighborhood"
                    placeholder="Mahalle" defaultValue={savedAddress?.neighborhood || ""}
                  />

                  <input
                    name="postalCode"
                    placeholder="Posta Kodu" defaultValue={savedAddress?.postalCode || ""}
                  />

                </div>

                <textarea
                  name="address"
                  required
                  placeholder="Açık adres" defaultValue={savedAddress?.address || ""}
                />

                <textarea
                  name="note"
                  placeholder="Sipariş notu"
                />

                <div className="paymentChoices">
                  <label>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Kredi / Banka Kartı"
                      defaultChecked
                    />
                    <span>
                      <b>Kredi / Banka Kartı</b>
                      <small>
                        Kart altyapısı canlıya geçerken bağlanacak.
                      </small>
                    </span>
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="Havale / EFT"
                    />
                    <span>
                      <b>Havale / EFT</b>
                      <small>
                        {settings.iban
                          ? `${settings.bankName || "Banka"} • ${settings.iban}`
                          : "IBAN bilgisi yönetim panelinden eklenir."}
                      </small>
                    </span>
                  </label>
                </div>

                <input
                  type="hidden"
                  name="cargoFee"
                  value={checkoutCargoFee}
                />


                <div className="checkoutShippingSummary">
                  <div><span>Ara Toplam</span><b>{money(cartTotal)}</b></div>
                  <div><span>Kargo • Aras Kargo</span><b>{checkoutCargoFee===0 ? "Ücretsiz" : money(checkoutCargoFee)}</b></div>
                  {n(settings.freeShippingThreshold)>0 && <small>{money(settings.freeShippingThreshold)} ve üzeri siparişlerde kargo ücretsiz.</small>}
                </div>

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(checkoutGrandTotal)}
                  </strong>
                </div>

                <button
                  className="orderButton"
                  type="submit"
                >
                  SİPARİŞİ OLUŞTUR
                </button>

              </>
            ) : (
              <div className="success">

                <b>✓</b>

                <h3>
                  Sipariş Alındı
                </h3>

                <p>
                  Sipariş No:
                </p>

                <strong>
                  {orderSuccess.orderNo}
                </strong>

                <button
                  type="button"
                  onClick={()=>{
                    setOrderSuccess(null);
                    setCheckout(false);
                    setCartOpen(false);
                    goHome();
                  }}
                >
                  TAMAM
                </button>

              </div>
            )}

          </form>
        )}

      </aside>

    </div>
  );
}

