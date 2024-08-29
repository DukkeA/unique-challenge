/* eslint-disable react-hooks/exhaustive-deps */
import { useContext, useEffect, useState } from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search } from "lucide-react";
import { AccountsContext } from "../accounts/AccountsContext";
import { SdkContext } from "../sdk/SdkContext";
import CryptoJS from "crypto-js";
import { Account } from "../accounts/types";

export default function ExplorerPage() {
  const { accounts, fetchPolkadotAccounts } = useContext(AccountsContext);
  const accountsArray = Array.from(accounts.values());
  const [collection, setCollection] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const { sdk } = useContext(SdkContext);
  const [nft, setNft] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [decryptedAttributes, setDecryptedAttributes] = useState<{
    [key: string]: any;
  }>({});

  useEffect(() => {
    if (accountsArray.length === 0) {
      fetchPolkadotAccounts();
    }
  }, [accountsArray.length, fetchPolkadotAccounts]);

  useEffect(() => {
    if (sdk && collection && tokenId) {
      fetchNFT();
    }
  }, [sdk, collection, tokenId]);

  useEffect(() => {
    if (nft && currentAccount) {
      verifyOwnershipAndDecrypt();
    }
  }, [nft, currentAccount]);

  async function fetchNFT() {
    try {
      setError(null);
      const token = await sdk?.token?.get({
        collectionId: collection,
        tokenId: parseInt(tokenId),
      });

      if (token) {
        setNft(token);
        setSearchPerformed(true);
      } else {
        setError("Token not found.");
        setNft(null);
        setDecryptedAttributes({});
      }
    } catch (error) {
      setError("Token not found.");
      setNft(null);
      setDecryptedAttributes({});
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchNFT();
  };

  const handleNumberInput =
    (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value === "" || /^\d+$/.test(value)) {
        setter(value);
      }
    };

  const handleAccountSelect = (address: string) => {
    const selectedAccount =
      accountsArray.find((account) => account.address === address) || null;
    setCurrentAccount(selectedAccount);
  };

  const verifyOwnershipAndDecrypt = () => {
    if (!currentAccount || !nft) return;

    setIsLoading(true);

    try {
      const address = currentAccount.address;
      const encryptionKey = CryptoJS.SHA256(address).toString();

      const tokenData = JSON.parse(nft.properties[2].value);
      const newDecryptedAttributes: { [key: string]: any } = {};

      tokenData.attributes.forEach(
        (attr: { trait_type: string; value: any }) => {
          if (attr.trait_type === "Nickname") {
            newDecryptedAttributes[attr.trait_type] =
              address === nft.owner
                ? CryptoJS.AES.decrypt(attr.value, encryptionKey).toString(
                    CryptoJS.enc.Utf8
                  )
                : attr.value + " I'm encrypted 😵";
          } else {
            newDecryptedAttributes[attr.trait_type] = attr.value;
          }
        }
      );

      setDecryptedAttributes(newDecryptedAttributes);
    } catch (error) {
      console.error("Error verifying ownership:", error);
      setError("An error occurred during decryption.");
      setDecryptedAttributes({});
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto p-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold mb-4">NFT Explorer</h1>
          <div className="flex gap-4">
            <Select
              onValueChange={handleAccountSelect}
              value={currentAccount?.address || ""}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accountsArray.map((account) => (
                  <SelectItem key={account.address} value={account.address}>
                    {account.name ? account.name : account.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="collection" className="text-sm font-medium">
                    Collection
                  </label>
                  <Input
                    id="collection"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Enter collection number"
                    value={collection}
                    onChange={handleNumberInput(setCollection)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="tokenId" className="text-sm font-medium">
                    Token ID
                  </label>
                  <Input
                    id="tokenId"
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    placeholder="Enter token ID number"
                    value={tokenId}
                    onChange={handleNumberInput(setTokenId)}
                  />
                </div>
              </div>
              <Button type="button" className="w-full" onClick={handleSearch}>
                <Search className="mr-2 h-4 w-4" /> Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {searchPerformed && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Search Results</h2>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-red-500">{error}</p>
            ) : nft ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground">
                    <div>Owner: {nft.owner}</div>
                    <div>Collection: {nft.collectionId}</div>
                    <div>Token: {nft.tokenId}</div>
                    {Object.entries(decryptedAttributes).map(
                      ([trait_type, value]) => (
                        <div key={trait_type}>
                          {trait_type}: {value}
                        </div>
                      )
                    )}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <p className="text-muted-foreground">
                Please select an account to view results.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
